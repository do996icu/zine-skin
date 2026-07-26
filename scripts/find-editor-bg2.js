'use strict';
const fs = require('fs');
const css = fs.readFileSync(
	'C:/Users/do996/AppData/Local/Programs/cursor/resources/app/out/vs/workbench/workbench.desktop.main.css',
	'utf8'
);

function rulesContaining(substr) {
	const out = [];
	let idx = 0;
	while ((idx = css.indexOf(substr, idx)) !== -1) {
		let start = css.lastIndexOf('{', idx);
		start = css.lastIndexOf('}', start) + 1;
		const end = css.indexOf('}', idx) + 1;
		out.push(css.slice(start, end).replace(/\s+/g, ' ').trim());
		idx = end;
		if (out.length > 25) break;
	}
	return out;
}

for (const key of [
	'editor-group-container.empty',
	'editor-group-container{',
	'.part.editor{',
	'.part.editor>.content{',
	'grid-view-container',
	'empty-group',
	'editorEmpty'
]) {
	console.log('\n====', key, '====');
	rulesContaining(key)
		.slice(0, 8)
		.forEach((r) => console.log(r.slice(0, 280)));
}
