'use strict';

/**
 * 延迟清理：扩展 deactivate 后由独立进程执行。
 * - 若 activate 已取消 pendingCleanup（窗口重载）→ 保留皮肤
 * - 若扩展目录已消失（卸载）或仍标记 pendingCleanup（禁用）→ 还原安装目录
 *
 * 用法: node orphanCleanup.js <leasePath> [delayMs]
 * 在 Cursor/Electron 下用 ELECTRON_RUN_AS_NODE=1 调用。
 */

const fs = require('fs');
const path = require('path');

const leasePath = process.argv[2];
const delayMs = Math.max(500, Number(process.argv[3]) || 3500);

function logError(err) {
	try {
		if (!leasePath) return;
		fs.writeFileSync(
			`${leasePath}.error`,
			`${new Date().toISOString()}\n${err && err.stack ? err.stack : String(err)}\n`,
			'utf8'
		);
	} catch (_) {
		/* ignore */
	}
}

function shouldRemove(lease) {
	if (!lease || !lease.appRoot) {
		return false;
	}
	if (lease.extensionPath && !fs.existsSync(lease.extensionPath)) {
		return true;
	}
	return Boolean(lease.pendingCleanup);
}

function run() {
	setTimeout(() => {
		try {
			if (!leasePath || !fs.existsSync(leasePath)) {
				return;
			}
			const raw = fs.readFileSync(leasePath, 'utf8').replace(/^\uFEFF/, '');
			const lease = JSON.parse(raw);
			if (!shouldRemove(lease)) {
				return;
			}
			const patcher = require('./patcher');
			patcher.remove(lease.appRoot, {
				fixChecksums: lease.fixChecksums !== false
			});
			try {
				fs.unlinkSync(leasePath);
			} catch (_) {
				/* ignore */
			}
		} catch (err) {
			logError(err);
		}
	}, delayMs);
}

run();
