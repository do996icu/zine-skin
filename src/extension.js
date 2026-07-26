'use strict';

const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const patcher = require('./patcher');
const { buildTheme } = require('./theme');
const { openThemeSettings } = require('./themePanel');
const i18n = require('./i18n');

const SECTION = 'cursorSkin';
const THEME_LABEL = 'Skin Dark';
const THEME_FILE = 'skin-dark-color-theme.json';
const THEME_URI_PATH = '/theme';
const SETTINGS_URI_PATH = '/settings';
const LEASE_NAME = 'lease.json';
const CLEANUP_DELAY_MS = 3500;

/** @type {{ dir: string, leasePath: string, extensionPath: string } | null} */
let cleanupCtx = null;

function openExtensionSettings(context) {
	return vscode.commands.executeCommand(
		'workbench.action.openSettings',
		`@ext:${context.extension.id}`
	);
}

function readConfig() {
	const cfg = vscode.workspace.getConfiguration(SECTION);
	return {
		enabled: cfg.get('enabled', true),
		backgroundImage: cfg.get('backgroundImage', ''),
		opacity: cfg.get('opacity', 0.4),
		blur: cfg.get('blur', 0),
		size: cfg.get('size', 'cover'),
		position: cfg.get('position', 'center center'),
		accentColor: cfg.get('accentColor', '#7C9EF6'),
		backgroundColor: cfg.get('backgroundColor', '#0F1115'),
		panelOpacity: cfg.get('panelOpacity', 0.82),
		editorOpacity: cfg.get('editorOpacity', 0.7),
		customCss: cfg.get('customCss', ''),
		installPath: cfg.get('installPath', ''),
		fixChecksums: cfg.get('fixChecksums', true)
	};
}

function targetAppRoot(config) {
	return patcher.resolveAppRoot(config.installPath, vscode.env.appRoot);
}

/** 把调色板写进扩展自带的主题文件，颜色主题选中后即时生效（需重载窗口）。 */
function regenerateTheme(context, config) {
	const basePath = path.join(context.extensionPath, 'base', 'cursor-dark-color-theme.json');
	const outPath = path.join(context.extensionPath, 'themes', THEME_FILE);
	const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
	const theme = buildTheme(base, {
		name: THEME_LABEL,
		accent: config.accentColor,
		background: config.backgroundColor,
		panelOpacity: config.panelOpacity,
		editorOpacity: config.editorOpacity
	});
	const next = JSON.stringify(theme, null, '\t') + '\n';
	const previous = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null;
	if (previous === next) {
		return false;
	}
	fs.mkdirSync(path.dirname(outPath), { recursive: true });
	fs.writeFileSync(outPath, next, 'utf8');
	return true;
}

function describeError(error) {
	const message = error && error.message ? error.message : String(error);
	if (/EPERM|EACCES/i.test(message)) {
		return `${message}\n没有写入安装目录的权限，请关闭 Cursor 后以管理员身份重试，或把 cursorSkin.installPath 指向一份可写的安装。`;
	}
	return message;
}

function samePath(a, b) {
	const normalize = (p) =>
		process.platform === 'win32' ? path.normalize(p).toLowerCase() : path.normalize(p);
	return normalize(a) === normalize(b);
}

function ensureCleanupTools(context) {
	const dir = context.globalStorageUri.fsPath;
	fs.mkdirSync(dir, { recursive: true });
	for (const name of ['patcher.js', 'orphanCleanup.js']) {
		fs.copyFileSync(path.join(context.extensionPath, 'src', name), path.join(dir, name));
	}
	cleanupCtx = {
		dir,
		leasePath: path.join(dir, LEASE_NAME),
		extensionPath: context.extensionPath
	};
	return cleanupCtx;
}

function readLease(leasePath) {
	try {
		if (!fs.existsSync(leasePath)) {
			return null;
		}
		const raw = fs.readFileSync(leasePath, 'utf8').replace(/^\uFEFF/, '');
		return JSON.parse(raw);
	} catch (_) {
		return null;
	}
}

function writeLease(leasePath, patch) {
	const prev = readLease(leasePath) || {};
	const next = {
		...prev,
		...patch,
		ts: Date.now()
	};
	fs.mkdirSync(path.dirname(leasePath), { recursive: true });
	fs.writeFileSync(leasePath, JSON.stringify(next, null, '\t') + '\n', 'utf8');
	return next;
}

function clearLease(leasePath) {
	try {
		if (leasePath && fs.existsSync(leasePath)) {
			fs.unlinkSync(leasePath);
		}
	} catch (_) {
		/* ignore */
	}
}

/** 禁用 / 卸载后延迟还原；窗口重载时 activate 会取消 pendingCleanup。 */
function resolveCleanupRunner() {
	try {
		const { execSync } = require('child_process');
		const out = execSync('node -v', {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
			windowsHide: true,
			timeout: 3000
		});
		if (out && /^v\d+/.test(String(out).trim())) {
			return { command: 'node', env: { ...process.env } };
		}
	} catch (_) {
		/* fall through */
	}
	return {
		command: process.execPath,
		env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
	};
}

function scheduleOrphanCleanup() {
	if (!cleanupCtx) {
		return;
	}
	const { dir, leasePath, extensionPath } = cleanupCtx;
	try {
		const prev = readLease(leasePath) || {};
		if (!prev.appRoot) {
			return;
		}
		writeLease(leasePath, {
			...prev,
			pendingCleanup: true,
			pendingAt: Date.now(),
			extensionPath
		});
		const { spawn } = require('child_process');
		const runner = resolveCleanupRunner();
		const child = spawn(
			runner.command,
			[path.join(dir, 'orphanCleanup.js'), leasePath, String(CLEANUP_DELAY_MS)],
			{
				detached: true,
				stdio: 'ignore',
				windowsHide: true,
				env: runner.env
			}
		);
		child.unref();
	} catch (_) {
		/* ignore */
	}
}

async function offerReload(reason, appRoot) {
	const isRunningInstall = samePath(appRoot, vscode.env.appRoot);
	if (!isRunningInstall) {
		vscode.window.showInformationMessage(
			`${reason} 补丁已写入 ${appRoot}，重启那份 Cursor 后生效。`
		);
		return;
	}
	const choice = await vscode.window.showInformationMessage(
		`${reason} 重载窗口后生效。`,
		'立即重载',
		'稍后'
	);
	if (choice === '立即重载') {
		await vscode.commands.executeCommand('workbench.action.reloadWindow');
	}
}

let syncing = false;

async function sync(context, { silent = false, reason = '皮肤已更新。' } = {}) {
	if (syncing) {
		return;
	}
	syncing = true;
	try {
		const config = readConfig();
		let appRoot;
		try {
			appRoot = targetAppRoot(config);
		} catch (error) {
			if (!silent) {
				vscode.window.showErrorMessage(`Zine Skin：${describeError(error)}`);
			}
			return;
		}

		let themeChanged = false;
		try {
			themeChanged = regenerateTheme(context, config);
		} catch (error) {
			vscode.window.showErrorMessage(`Zine Skin：生成配色失败。${describeError(error)}`);
		}

		const needsInjection = Boolean(config.enabled);

		try {
			const result =
				config.enabled && needsInjection
					? patcher.apply(appRoot, config)
					: patcher.remove(appRoot, config);

			if (result.backgroundMissing) {
				await vscode.workspace
					.getConfiguration(SECTION)
					.update('backgroundImage', '', vscode.ConfigurationTarget.Global);
				if (!silent) {
					vscode.window.showWarningMessage(
						`Zine Skin：背景图文件已不存在，已清除壁纸设置。\n${result.backgroundMissingPath || ''}`
					);
				}
			}

			if (cleanupCtx) {
				if (config.enabled) {
					writeLease(cleanupCtx.leasePath, {
						appRoot,
						fixChecksums: config.fixChecksums !== false,
						extensionPath: cleanupCtx.extensionPath,
						pendingCleanup: false
					});
				} else {
					clearLease(cleanupCtx.leasePath);
				}
			}

			// 启动时的静默同步：只有真正改写了 html/css 才提示（避免每次启动都弹）
			const needsReload = result.changed || (!silent && themeChanged);
			if (needsReload) {
				await offerReload(reason, appRoot);
			} else if (!silent) {
				vscode.window.showInformationMessage('Zine Skin：当前配置已经是最新状态。');
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Zine Skin：写入失败。${describeError(error)}`);
		}
	} finally {
		syncing = false;
	}
}

async function pickImage(context) {
	const picked = await vscode.window.showOpenDialog({
		canSelectMany: false,
		openLabel: '用作背景图',
		filters: { 图片: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'svg'] }
	});
	if (!picked || !picked.length) {
		return;
	}
	await vscode.workspace
		.getConfiguration(SECTION)
		.update('backgroundImage', picked[0].fsPath, vscode.ConfigurationTarget.Global);
	// 配置变更监听会触发同步；这里再同步一次并带上明确文案
	await sync(context, { reason: '背景图已更新。' });
}

async function pickAccent(context) {
	const current = readConfig().accentColor;
	const value = await vscode.window.showInputBox({
		title: '主题色',
		prompt: '输入十六进制颜色，例如 #7C9EF6',
		value: current,
		validateInput: (input) =>
			/^#?[0-9a-fA-F]{6}$/.test(String(input).trim())
				? undefined
				: '需要 6 位十六进制颜色，例如 #7C9EF6'
	});
	if (!value) {
		return;
	}
	const normalized = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
	await vscode.workspace
		.getConfiguration(SECTION)
		.update('accentColor', normalized, vscode.ConfigurationTarget.Global);
	await sync(context, { reason: '主题色已更新。' });
}

function showStatus() {
	const config = readConfig();
	let appRoot;
	try {
		appRoot = targetAppRoot(config);
	} catch (error) {
		vscode.window.showErrorMessage(`Zine Skin：${describeError(error)}`);
		return;
	}
	const paths = patcher.workbenchPaths(appRoot);
	const css = patcher.currentCss(appRoot);
	const lines = [
		`目标安装：${appRoot}`,
		`当前运行：${vscode.env.appRoot}`,
		`补丁状态：${patcher.isPatched(appRoot) ? '已注入' : '未注入'}`,
		`样式文件：${css ? `${paths.css}（${(Buffer.byteLength(css) / 1024).toFixed(1)} KB）` : '不存在'}`,
		`背景图：${config.backgroundImage || '(未设置)'}`,
		`主题色：${config.accentColor}`,
		`面板不透明度：${config.panelOpacity}　编辑器不透明度：${config.editorOpacity}`
	];
	vscode.window.showInformationMessage(lines.join('\n'), { modal: true });
}

function activate(context) {
	let configTimer;

	ensureCleanupTools(context);
	// 尽早取消「待清理」，避免窗口重载时被延迟任务误删补丁
	if (cleanupCtx) {
		const prev = readLease(cleanupCtx.leasePath);
		if (prev && prev.appRoot) {
			writeLease(cleanupCtx.leasePath, {
				...prev,
				pendingCleanup: false,
				extensionPath: context.extensionPath
			});
		}
	}

	const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	status.text = '$(symbol-color) Theme';
	status.tooltip = i18n.t('panelTitle');
	status.command = 'cursorSkin.openThemeSettings';
	status.show();

	context.subscriptions.push(
		status,
		vscode.window.registerUriHandler({
			handleUri(uri) {
				const path = (uri.path || '').replace(/\/+$/, '') || '/';
				if (path === SETTINGS_URI_PATH || path === 'settings') {
					openExtensionSettings(context);
					return;
				}
				if (path === THEME_URI_PATH || path === 'theme' || uri.path === THEME_URI_PATH) {
					openThemeSettings(context, {
						onApplied: () => sync(context, { reason: i18n.t('applied') })
					});
				}
			}
		}),
		vscode.commands.registerCommand('cursorSkin.openThemeSettings', () =>
			openThemeSettings(context, {
				onApplied: () => sync(context, { reason: i18n.t('applied') })
			})
		),
		vscode.commands.registerCommand('cursorSkin.openSettings', () => openExtensionSettings(context)),
		vscode.commands.registerCommand('cursorSkin.apply', () =>
			sync(context, { reason: '皮肤已应用。' })
		),
		vscode.commands.registerCommand('cursorSkin.remove', async () => {
			await vscode.workspace
				.getConfiguration(SECTION)
				.update('enabled', false, vscode.ConfigurationTarget.Global);
			await sync(context, { reason: '皮肤已移除，安装目录已还原。' });
		}),
		vscode.commands.registerCommand('cursorSkin.pickImage', () => pickImage(context)),
		vscode.commands.registerCommand('cursorSkin.pickAccent', () => pickAccent(context)),
		vscode.commands.registerCommand('cursorSkin.status', showStatus),
		vscode.workspace.onDidChangeConfiguration((event) => {
			if (!event.affectsConfiguration(SECTION)) {
				return;
			}
			// 防抖：避免改一项设置连弹多次；与命令里的 sync 用 syncing 锁互斥
			clearTimeout(configTimer);
			configTimer = setTimeout(() => {
				sync(context, { silent: true, reason: '皮肤配置已变更。' });
			}, 400);
		}),
		{ dispose: () => clearTimeout(configTimer) }
	);

	// 启动只静默补丁；内容没变就不弹窗
	sync(context, { silent: true, reason: '皮肤已重新应用。' });
}

function deactivate() {
	scheduleOrphanCleanup();
}

module.exports = { activate, deactivate };
