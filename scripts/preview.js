'use strict';

// 用真实生成的 CSS 复刻一份工作台 DOM，方便在浏览器里核对层叠与可读性。
const fs = require('fs');
const path = require('path');
const os = require('os');
const patcher = require('../src/patcher');
const { buildTheme } = require('../src/theme');

const outDir = path.join(os.tmpdir(), 'cursor-skin-preview');
fs.mkdirSync(outDir, { recursive: true });

const imagePath = process.argv[2] || path.join(os.tmpdir(), 'cursor-skin-test.png');
if (!fs.existsSync(imagePath)) {
	throw new Error(`先跑 scripts/smoke-test.js 生成测试图，或传入图片路径。缺少：${imagePath}`);
}

const base = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'base', 'cursor-dark-color-theme.json'), 'utf8'));
const palette = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'palette.json'), 'utf8'));
const theme = buildTheme(base, palette);
const c = theme.colors;

function page(label, css) {
	return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${label}</title>
<style>
	html, body { margin: 0; height: 100%; }
	body { background-color: ${palette.background}; font-family: "Segoe UI", sans-serif; font-size: 13px; }
	/* 与 workbench.desktop.main.css 中 .monaco-workbench 的关键属性保持一致 */
	.monaco-workbench { position: relative; z-index: 1; overflow: hidden; height: 100vh;
		display: grid; grid-template-columns: 48px 240px 1fr; grid-template-rows: 32px 1fr 22px;
		grid-template-areas: "title title title" "activity sidebar editor" "status status status";
		color: ${c['editor.foreground']}; }
	.title { grid-area: title; background: ${c['titleBar.activeBackground']}; display: flex; align-items: center; padding: 0 12px; color: ${c['titleBar.activeForeground']}; }
	.activity { grid-area: activity; background: ${c['activityBar.background']}; display: flex; flex-direction: column; align-items: center; padding-top: 10px; gap: 14px; }
	.activity i { width: 22px; height: 22px; border-radius: 6px; background: ${c['activityBar.foreground']}; opacity: .5; display: block; }
	.activity i.on { background: ${c['activityBarBadge.background']}; opacity: 1; }
	.sidebar { grid-area: sidebar; background: ${c['sideBar.background']}; padding: 10px 12px; color: ${c['sideBar.foreground']}; }
	.sidebar .row { padding: 4px 8px; border-radius: 5px; }
	.sidebar .row.sel { background: ${c['list.activeSelectionBackground']}; color: ${c['list.activeSelectionForeground']}; }
	.editorwrap { grid-area: editor; display: flex; flex-direction: column; }
	.tabs { background: ${c['editorGroupHeader.tabsBackground']}; display: flex; height: 34px; }
	.tab { padding: 0 16px; line-height: 34px; background: ${c['tab.inactiveBackground']}; }
	.tab.active { background: ${c['tab.activeBackground']}; box-shadow: inset 0 2px 0 ${c['tab.activeBorderTop']}; }
	.editor { flex: 1; background: ${c['editor.background']}; padding: 14px 20px; line-height: 1.7; font-family: Consolas, monospace; }
	.status { grid-area: status; background: ${c['statusBar.background']}; color: ${c['statusBar.foreground']}; display: flex; align-items: center; padding: 0 12px; gap: 16px; }
	.k { color: #C586C0; } .s { color: #CE9178; } .f { color: #DCDCAA; } .cm { color: #6A9955; }
	.btn { background: ${c['button.background']}; color: ${c['button.foreground']}; border-radius: 5px; padding: 3px 12px; display: inline-block; margin-top: 12px; }
	.widget { position: absolute; right: 40px; top: 90px; width: 300px; background: ${c['editorWidget.background']};
		border: 1px solid ${c['editorWidget.border']}; border-radius: 8px; padding: 10px; }
</style>
<style>
${css}
</style>
</head>
<body>
<div class="monaco-workbench">
	<div class="title">Cursor Skin — ${label}</div>
	<div class="activity"><i class="on"></i><i></i><i></i><i></i></div>
	<div class="sidebar">
		<div style="opacity:.6;margin-bottom:6px">资源管理器</div>
		<div class="row">src</div>
		<div class="row sel">extension.js</div>
		<div class="row">patcher.js</div>
		<div class="row">theme.js</div>
		<div class="btn">主题色按钮</div>
	</div>
	<div class="editorwrap">
		<div class="tabs"><div class="tab active">extension.js</div><div class="tab">patcher.js</div></div>
		<div class="editor">
			<div class="cm">// 检查正文在半透明底色上的可读性</div>
			<div><span class="k">const</span> <span class="f">patcher</span> = require(<span class="s">'./patcher'</span>);</div>
			<div><span class="k">async function</span> <span class="f">sync</span>(context) {</div>
			<div>&nbsp;&nbsp;<span class="k">const</span> config = <span class="f">readConfig</span>();</div>
			<div>&nbsp;&nbsp;<span class="k">return</span> patcher.<span class="f">apply</span>(appRoot, config);</div>
			<div>}</div>
		</div>
	</div>
	<div class="status"><span>main*</span><span>0 errors</span><span>Skin Dark</span></div>
	<div class="widget">浮层保持不透明，文字不会糊在背景图上。</div>
</div>
</body></html>`;
}

const shared = {
	backgroundImage: imagePath,
	size: 'cover',
	position: 'center center',
	backgroundColor: palette.background
};

const variants = [
	['flat', '直接铺图（blur = 0）', { ...shared, opacity: 0.16, blur: 0 }],
	['blur', '伪元素 + 模糊（blur = 24）', { ...shared, opacity: 0.5, blur: 24 }]
];

for (const [slug, label, options] of variants) {
	const file = path.join(outDir, `${slug}.html`);
	fs.writeFileSync(file, page(label, patcher.buildCss(options)), 'utf8');
	console.log(file);
}
