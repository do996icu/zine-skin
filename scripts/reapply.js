'use strict';

const fs = require('fs');
const path = require('path');
const patcher = require('../src/patcher');

const settings = JSON.parse(
	fs.readFileSync(process.env.APPDATA + '/Cursor/User/settings.json', 'utf8')
);

const install =
	settings['cursorSkin.installPath'] ||
	'C:\\Users\\do996\\AppData\\Local\\Programs\\cursor';

const appRoot = patcher.resolveAppRoot(install, null);
const result = patcher.apply(appRoot, {
	backgroundImage: settings['cursorSkin.backgroundImage'],
	opacity: settings['cursorSkin.opacity'] ?? 0.4,
	blur: settings['cursorSkin.blur'] ?? 0,
	size: settings['cursorSkin.size'] || 'cover',
	position: settings['cursorSkin.position'] || 'center center',
	backgroundColor: settings['cursorSkin.backgroundColor'] || '#0F1115',
	panelOpacity: settings['cursorSkin.panelOpacity'] ?? 0.75,
	editorOpacity: settings['cursorSkin.editorOpacity'] ?? 0.55,
	customCss: settings['cursorSkin.customCss'] || '',
	fixChecksums: settings['cursorSkin.fixChecksums'] !== false
});

const css = fs.readFileSync(result.paths.css, 'utf8');
const product = JSON.parse(fs.readFileSync(result.paths.product, 'utf8'));
const expected = product.checksums['vs/code/electron-sandbox/workbench/workbench.html'];
const actual = patcher.checksum(result.paths.html);

console.log(
	JSON.stringify(
		{
			appRoot,
			backgroundImageUrl: result.backgroundImageUrl,
			cssKB: (Buffer.byteLength(css) / 1024).toFixed(1),
			patched: patcher.isPatched(appRoot),
			checksumOK: expected === actual,
			cssHasBefore: css.includes('body::before'),
			cssHasPart: css.includes('.part.sidebar'),
			stagedBg: fs
				.readdirSync(result.paths.dir)
				.filter((n) => n.startsWith('cursor-skin-bg'))
		},
		null,
		2
	)
);
console.log('\n--- css preview ---\n');
console.log(css.slice(0, 900));
