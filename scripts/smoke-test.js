'use strict';

// 对指定安装目录跑一遍「打补丁 -> 校验 -> 还原」，确认补丁可逆且校验和保持一致。
const fs = require('fs');
const path = require('path');
const os = require('os');
const zlib = require('zlib');
const assert = require('assert');
const patcher = require('../src/patcher');

const CRC_TABLE = (() => {
	const table = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c;
	}
	return table;
})();

function crc32(buf) {
	let c = -1;
	for (let i = 0; i < buf.length; i++) {
		c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	}
	return (c ^ -1) >>> 0;
}

function chunk(type, data) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, crc]);
}

function gradientPng(width, height) {
	const raw = Buffer.alloc((width * 3 + 1) * height);
	let offset = 0;
	for (let y = 0; y < height; y++) {
		raw[offset++] = 0;
		for (let x = 0; x < width; x++) {
			const v = y / height;
			const u = x / width;
			raw[offset++] = Math.round(20 + 60 * v + 30 * u);
			raw[offset++] = Math.round(24 + 40 * v + 50 * u);
			raw[offset++] = Math.round(48 + 90 * v + 60 * u);
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0))
	]);
}

const installPath = process.argv[2] || 'C:\\Users\\do996\\AppData\\Local\\Programs\\cursor-skin';
const appRoot = patcher.resolveAppRoot(installPath, null);
const paths = patcher.workbenchPaths(appRoot);

const imagePath = path.join(os.tmpdir(), 'cursor-skin-test.png');
fs.writeFileSync(imagePath, gradientPng(1200, 800));

const before = fs.readFileSync(paths.html);
const productBefore = JSON.parse(fs.readFileSync(paths.product, 'utf8'));
const checksumBefore = productBefore.checksums['vs/code/electron-sandbox/workbench/workbench.html'];
console.log(`目标安装：${appRoot}`);
console.log(`原始校验和：${checksumBefore}`);
assert.strictEqual(checksumBefore, patcher.checksum(paths.html), '打补丁前 product.json 校验和与文件不一致');

const applied = patcher.apply(appRoot, {
	backgroundImage: imagePath,
	opacity: 0.16,
	blur: 0,
	size: 'cover',
	position: 'center center',
	backgroundColor: '#0F1115',
	fixChecksums: true
});
console.log('apply ->', { htmlChanged: applied.htmlChanged, cssChanged: applied.cssChanged, checksumChanged: applied.checksumChanged });

const patchedHtml = fs.readFileSync(paths.html, 'utf8');
assert.ok(patchedHtml.includes('cursor-skin:start'), '注入标记缺失');
assert.ok(patchedHtml.includes('<link rel="stylesheet" href="./cursor-skin.css">'), '样式链接缺失');
assert.ok(fs.existsSync(paths.css), '样式文件未生成');
assert.ok(fs.existsSync(paths.backup), '备份文件未生成');

const patchedCss = fs.readFileSync(paths.css, 'utf8');
assert.ok(patchedCss.includes('data:image/png;base64,'), '背景图未内联');
console.log(`样式体积：${(Buffer.byteLength(patchedCss) / 1024).toFixed(1)} KB`);

const productPatched = JSON.parse(fs.readFileSync(paths.product, 'utf8'));
assert.strictEqual(
	productPatched.checksums['vs/code/electron-sandbox/workbench/workbench.html'],
	patcher.checksum(paths.html),
	'打补丁后校验和未同步'
);
console.log('校验和已同步，不会触发「安装似乎已损坏」提示');

// 重复应用应当是幂等的
const again = patcher.apply(appRoot, {
	backgroundImage: imagePath,
	opacity: 0.16,
	blur: 0,
	size: 'cover',
	position: 'center center',
	backgroundColor: '#0F1115',
	fixChecksums: true
});
assert.strictEqual(again.changed, false, '重复应用不应产生变更');
console.log('重复应用：幂等 ✓');

const removed = patcher.remove(appRoot, { fixChecksums: true });
console.log('remove ->', { htmlChanged: removed.htmlChanged, cssRemoved: removed.cssRemoved });
assert.ok(fs.readFileSync(paths.html).equals(before), '还原后 workbench.html 与原始内容不一致');
assert.ok(!fs.existsSync(paths.css), '样式文件未清理');
const productRestored = JSON.parse(fs.readFileSync(paths.product, 'utf8'));
assert.strictEqual(
	productRestored.checksums['vs/code/electron-sandbox/workbench/workbench.html'],
	checksumBefore,
	'还原后校验和未回到原值'
);
console.log('还原：字节级一致，校验和回到原值 ✓');
console.log('\n全部通过。');
