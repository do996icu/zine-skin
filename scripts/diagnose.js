'use strict';

const fs = require('fs');
const path = require('path');
const patcher = require('../src/patcher');

const app = patcher.resolveAppRoot(
	'C:\\Users\\do996\\AppData\\Local\\Programs\\cursor',
	null
);
const product = JSON.parse(fs.readFileSync(path.join(app, 'product.json'), 'utf8'));

console.log('=== checksums ===');
for (const [rel, expected] of Object.entries(product.checksums || {})) {
	const file = path.join(app, 'out', ...rel.split('/'));
	const actual = fs.existsSync(file) ? patcher.checksum(file) : 'MISSING';
	console.log(expected === actual ? 'OK ' : 'BAD', rel);
}

const cssPath = path.join(
	app,
	'out/vs/code/electron-sandbox/workbench/cursor-skin.css'
);
const css = fs.readFileSync(cssPath, 'utf8');
console.log('css bytes', css.length);
console.log('has data uri', /url\("data:image\//.test(css));
console.log('head:\n' + css.slice(0, 400));

const themePath =
	'C:\\Users\\do996\\.cursor\\extensions\\local.cursor-skin-0.1.0\\themes\\skin-dark-color-theme.json';
const theme = JSON.parse(fs.readFileSync(themePath, 'utf8'));
for (const k of [
	'editor.background',
	'sideBar.background',
	'activityBar.background',
	'titleBar.activeBackground'
]) {
	console.log(k, theme.colors[k]);
}

const settings = JSON.parse(
	fs.readFileSync(process.env.APPDATA + '/Cursor/User/settings.json', 'utf8')
);
const img = settings['cursorSkin.backgroundImage'];
console.log('img', img);
console.log('img exists', fs.existsSync(img));
console.log('img size MB', (fs.statSync(img).size / 1024 / 1024).toFixed(2));
