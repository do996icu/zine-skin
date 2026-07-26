'use strict';
const fs = require('fs');
const css = fs.readFileSync(
	'C:/Users/do996/AppData/Local/Programs/cursor/resources/app/out/vs/workbench/workbench.desktop.main.css',
	'utf8'
);
const re = /[^{}]*editor-group-container[^{}.]*\{[^}]*\}/gi;
const all = [...css.matchAll(re)].map((x) => x[0].replace(/\s+/g, ' '));
const withBg = all.filter((x) => /background/i.test(x)).slice(0, 20);
console.log('rules with background', withBg.length);
withBg.forEach((x) => console.log(x.slice(0, 300), '\n'));

const re2 = /[^{}]*\.part\.editor>?\.content[^{}]*\{[^}]*background[^}]*\}/gi;
console.log('--- part.editor content ---');
[...css.matchAll(re2)].slice(0, 10).forEach((x) => console.log(x[0].replace(/\s+/g, ' ').slice(0, 300), '\n'));
