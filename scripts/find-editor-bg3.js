'use strict';
const fs = require('fs');
const css = fs.readFileSync(
	'C:/Users/do996/AppData/Local/Programs/cursor/resources/app/out/vs/workbench/workbench.desktop.main.css',
	'utf8'
);

// find all background-color rules for .part.editor (not deeper children only)
const re = /\.monaco-workbench[^,{]*\.part\.editor[^{,{]*\{[^}]*\}/g;
const matches = [...css.matchAll(re)].map((m) => m[0].replace(/\s+/g, ' '));
console.log('part.editor rules', matches.length);
matches.filter((m) => /background/i.test(m)).forEach((m) => console.log(m.slice(0, 350), '\n'));

console.log('\n--- tabsBorder ---');
let idx = 0;
let n = 0;
while ((idx = css.indexOf('editorGroupHeader-tabsBorder', idx)) !== -1 && n < 10) {
	console.log(css.slice(idx - 60, idx + 80).replace(/\s+/g, ' '));
	idx += 20;
	n++;
}

console.log('\n--- empty content background ---');
idx = 0;
n = 0;
while ((idx = css.indexOf('.content.empty', idx)) !== -1 && n < 15) {
	const slice = css.slice(idx, idx + 200).replace(/\s+/g, ' ');
	if (/background/i.test(slice)) console.log(slice.slice(0, 220));
	idx += 10;
	n++;
}
