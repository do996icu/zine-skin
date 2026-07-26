'use strict';

// 生成随扩展一起打包的默认配色；安装后扩展会按用户设置再次覆盖这个文件。
const fs = require('fs');
const path = require('path');
const { buildTheme, DEFAULTS } = require('../src/theme');

const root = path.join(__dirname, '..');
const base = JSON.parse(fs.readFileSync(path.join(root, 'base', 'cursor-dark-color-theme.json'), 'utf8'));
const palettePath = path.join(root, 'palette.json');
const palette = fs.existsSync(palettePath) ? JSON.parse(fs.readFileSync(palettePath, 'utf8')) : {};

const theme = buildTheme(base, { ...DEFAULTS, ...palette });
const outPath = path.join(root, 'themes', 'skin-dark-color-theme.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(theme, null, '\t') + '\n', 'utf8');

console.log(`已生成 ${path.relative(root, outPath)}，颜色键 ${Object.keys(theme.colors).length} 个。`);
