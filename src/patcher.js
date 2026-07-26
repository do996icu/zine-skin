'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const START_MARK = '<!-- cursor-skin:start -->';
const END_MARK = '<!-- cursor-skin:end -->';
const BODY_START = '<!-- cursor-skin:body-start -->';
const BODY_END = '<!-- cursor-skin:body-end -->';
const CSS_NAME = 'cursor-skin.css';
const MENU_JS_NAME = 'cursor-skin-menu.js';
const BG_BASENAME = 'cursor-skin-bg';
const BACKUP_SUFFIX = '.cursor-skin.bak';
const WALLPAPER_ID = 'cursor-skin-wallpaper';

const WORKBENCH_REL = 'vs/code/electron-sandbox/workbench/workbench.html';

const MIME_BY_EXT = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.bmp': 'image/bmp',
	'.avif': 'image/avif',
	'.svg': 'image/svg+xml'
};

function resolveAppRoot(configuredPath, runningAppRoot) {
	const candidates = [];
	if (configuredPath && configuredPath.trim()) {
		const p = configuredPath.trim().replace(/[\\/]+$/, '');
		candidates.push(p, path.join(p, 'resources', 'app'));
	}
	if (runningAppRoot) {
		candidates.push(runningAppRoot);
	}
	for (const candidate of candidates) {
		if (fs.existsSync(path.join(candidate, 'product.json')) && fs.existsSync(path.join(candidate, 'out'))) {
			return candidate;
		}
	}
	throw new Error(`找不到有效的 Cursor 安装目录，已尝试：${candidates.join(' , ') || '(空)'}`);
}

function workbenchPaths(appRoot) {
	const html = path.join(appRoot, 'out', ...WORKBENCH_REL.split('/'));
	const dir = path.dirname(html);
	return {
		html,
		css: path.join(dir, CSS_NAME),
		dir,
		backup: html + BACKUP_SUFFIX,
		product: path.join(appRoot, 'product.json')
	};
}

function checksum(filePath) {
	const data = fs.readFileSync(filePath);
	return crypto.createHash('sha256').update(data).digest('base64').replace(/=+$/, '');
}

function stripInjection(html) {
	let next = html
		.replace(new RegExp(`[\\t ]*${START_MARK}[\\s\\S]*?${END_MARK}\\r?\\n?`, 'g'), '')
		.replace(new RegExp(`[\\t ]*${BODY_START}[\\s\\S]*?${BODY_END}\\r?\\n?`, 'g'), '');
	// 去掉反复注入堆出来的空白，保证幂等
	next = next.replace(/<body([^>]*)>[\s\S]*?<\/body>/, '<body$1>\n\t</body>');
	return next;
}

function clearStagedBackgrounds(dir) {
	if (!fs.existsSync(dir)) {
		return;
	}
	for (const name of fs.readdirSync(dir)) {
		if (name === CSS_NAME || name === MENU_JS_NAME || name.startsWith(`${BG_BASENAME}.`)) {
			fs.unlinkSync(path.join(dir, name));
		}
	}
}

/**
 * 本地图：复制到 workbench 目录，并返回 data URI（避免 vscode-file 相对路径加载失败）。
 * https 原样返回。
 */
function resolveBackground(image, workbenchDir) {
	const value = String(image || '').trim();
	if (!value) {
		clearStagedBackgrounds(workbenchDir);
		return { url: null, staged: null };
	}
	if (/^https:/i.test(value) || /^data:/i.test(value)) {
		return { url: value, staged: null };
	}
	if (/^http:/i.test(value)) {
		throw new Error('工作台不允许 http:// 图片，请用 https:// 或本地文件。');
	}
	if (!fs.existsSync(value)) {
		throw new Error(`背景图不存在：${value}`);
	}
	let ext = path.extname(value).toLowerCase();
	if (!MIME_BY_EXT[ext]) {
		throw new Error(`不支持的图片格式：${ext || '(无扩展名)'}`);
	}
	if (ext === '.jpeg') {
		ext = '.jpg';
	}
	const stagedName = `${BG_BASENAME}${ext}`;
	const stagedPath = path.join(workbenchDir, stagedName);
	const incoming = fs.readFileSync(value);
	const same =
		fs.existsSync(stagedPath) &&
		fs.readFileSync(stagedPath).equals(incoming);
	if (!same) {
		fs.writeFileSync(stagedPath, incoming);
	}
	// 清掉其它后缀的旧壁纸
	for (const name of fs.readdirSync(workbenchDir)) {
		if (name.startsWith(`${BG_BASENAME}.`) && name !== stagedName) {
			fs.unlinkSync(path.join(workbenchDir, name));
		}
	}

	const mime = MIME_BY_EXT[ext] || MIME_BY_EXT['.jpg'];
	const size = incoming.length;
	if (size <= 1.2 * 1024 * 1024) {
		return { url: `data:${mime};base64,${incoming.toString('base64')}`, staged: stagedName };
	}
	return { url: `./${stagedName}`, staged: stagedName };
}

function hexToRgba(hex, alpha) {
	const raw = String(hex).replace(/^#/, '');
	const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
	const r = parseInt(full.slice(0, 2), 16) || 0;
	const g = parseInt(full.slice(2, 4), 16) || 0;
	const b = parseInt(full.slice(4, 6), 16) || 0;
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildCss(options) {
	const {
		backgroundImageUrl,
		opacity = 0.5,
		blur = 0,
		size = 'cover',
		position = 'center center',
		backgroundColor = '#0F1115',
		panelOpacity = 0.7,
		editorOpacity = 0.45,
		customCss = ''
	} = options || {};

	const panel = Math.min(1, Math.max(0, Number(panelOpacity)));
	const editor = Math.min(1, Math.max(0, Number(editorOpacity)));
	const clamped = Math.min(1, Math.max(0, Number(opacity)));
	const panelRgba = hexToRgba(backgroundColor, panel);
	const editorRgba = hexToRgba(backgroundColor, editor);
	const chromeRgba = hexToRgba(backgroundColor, Math.min(1, panel + 0.06));
	const blurPx = Number(blur) > 0 ? Number(blur) : 0;

	const blocks = [
		'/* 由 Zine Skin 扩展生成，请勿手动修改。 */',
		`html, body {`,
		`\theight: 100% !important;`,
		`\tbackground-color: ${backgroundColor} !important;`,
		`}`,
		/* 关键：改主题变量，否则各面板仍是不透明实底 */
		`.monaco-workbench {`,
		`\tbackground-color: transparent !important;`,
		`\t--vscode-editor-background: ${editorRgba} !important;`,
		`\t--vscode-editorPane-background: ${editorRgba} !important;`,
		`\t--vscode-editorGutter-background: ${editorRgba} !important;`,
		`\t--vscode-editorGroup-emptyBackground: ${editorRgba} !important;`,
		`\t--vscode-editorGroupHeader-tabsBorder: transparent !important;`,
		`\t--vscode-sideBar-background: ${panelRgba} !important;`,
		`\t--vscode-sideBarTitle-background: ${panelRgba} !important;`,
		`\t--vscode-sideBarSectionHeader-background: ${panelRgba} !important;`,
		`\t--vscode-activityBar-background: ${chromeRgba} !important;`,
		`\t--vscode-activityBarTop-background: ${chromeRgba} !important;`,
		`\t--vscode-titleBar-activeBackground: ${chromeRgba} !important;`,
		`\t--vscode-titleBar-inactiveBackground: ${chromeRgba} !important;`,
		`\t--vscode-statusBar-background: ${chromeRgba} !important;`,
		`\t--vscode-statusBar-noFolderBackground: ${chromeRgba} !important;`,
		`\t--vscode-statusBar-debuggingBackground: ${chromeRgba} !important;`,
		`\t--vscode-panel-background: ${editorRgba} !important;`,
		`\t--vscode-terminal-background: ${editorRgba} !important;`,
		`\t--vscode-editorGroupHeader-tabsBackground: ${panelRgba} !important;`,
		`\t--vscode-editorGroupHeader-noTabsBackground: ${panelRgba} !important;`,
		`\t--vscode-tab-activeBackground: ${editorRgba} !important;`,
		`\t--vscode-tab-inactiveBackground: ${panelRgba} !important;`,
		`\t--vscode-tab-unfocusedActiveBackground: ${editorRgba} !important;`,
		`\t--vscode-tab-unfocusedInactiveBackground: ${panelRgba} !important;`,
		`\t--vscode-breadcrumb-background: ${editorRgba} !important;`,
		`\t--vscode-minimap-background: ${hexToRgba(backgroundColor, editor * 0.45)} !important;`,
		`\t--vscode-sideBarStickyScroll-background: ${panelRgba} !important;`,
		`\t--composer-pane-background: ${editorRgba} !important;`,
		`\t--glass-vibrancy-on-surface-background: ${editorRgba} !important;`,
		`\t--glass-chat-surface-background: ${editorRgba} !important;`,
		`\t--glass-editor-surface-background: ${editorRgba} !important;`,
		`\t--glass-surface-background: ${editorRgba} !important;`,
		`\t--glass-sidebar-surface-background: ${panelRgba} !important;`,
		`\t--glass-onboard-surface-background: ${editorRgba} !important;`,
		`\t--glass-vibrancy-off-chat-surface-background: ${editorRgba} !important;`,
		`\t--glass-vibrancy-off-editor-surface-background: ${editorRgba} !important;`,
		`\t--glass-vibrancy-off-sidebar-surface-background: ${panelRgba} !important;`,
		/* Cursor / Glass Agents 窗口：chat/editor 表面读 chrome，必须半透明 */
		`\t--cursor-bg-sidebar: ${panelRgba} !important;`,
		`\t--cursor-bg-editor: ${editorRgba} !important;`,
		`\t--cursor-bg-chrome: ${editorRgba} !important;`,
		`\t--cursor-bg-secondary: ${panelRgba} !important;`,
		`\t--cursor-bg-tertiary: ${hexToRgba(backgroundColor, Math.min(1, panel + 0.08))} !important;`,
		`\t--cursor-bg-elevated: ${hexToRgba(backgroundColor, Math.min(1, editor + 0.25))} !important;`,
		`}`,
		/* glass 根节点上的 token 会盖掉 .monaco-workbench，再盖一层 */
		`body.cursor-dark [data-component="root"],`,
		`body.cursor-light [data-component="root"],`,
		`body[data-cursor-glass-mode="true"] [data-component="root"],`,
		`[data-component="root"] {`,
		`\t--glass-surface-background: ${editorRgba} !important;`,
		`\t--glass-sidebar-surface-background: ${panelRgba} !important;`,
		`\t--glass-chat-surface-background: ${editorRgba} !important;`,
		`\t--glass-editor-surface-background: ${editorRgba} !important;`,
		`\t--glass-onboard-surface-background: ${editorRgba} !important;`,
		`\t--glass-vibrancy-on-surface-background: ${editorRgba} !important;`,
		`\t--glass-vibrancy-off-chat-surface-background: ${editorRgba} !important;`,
		`\t--glass-vibrancy-off-editor-surface-background: ${editorRgba} !important;`,
		`\t--glass-vibrancy-off-sidebar-surface-background: ${panelRgba} !important;`,
		`\t--cursor-bg-chrome: ${editorRgba} !important;`,
		`\t--cursor-bg-editor: ${editorRgba} !important;`,
		`\t--cursor-bg-sidebar: ${panelRgba} !important;`,
		`\t--vscode-sideBar-background: ${panelRgba} !important;`,
		`\t--vscode-editor-background: ${editorRgba} !important;`,
		`}`
	];

	if (backgroundImageUrl) {
		blocks.push(
			`#${WALLPAPER_ID}, html::before {`,
			`\tcontent: "" !important;`,
			`\tdisplay: block !important;`,
			`\tposition: fixed !important;`,
			`\ttop: 0 !important;`,
			`\tleft: 0 !important;`,
			`\tright: 0 !important;`,
			`\tbottom: 0 !important;`,
			`\twidth: 100vw !important;`,
			`\theight: 100vh !important;`,
			`\tz-index: 0 !important;`,
			`\tpointer-events: none !important;`,
			`\tbackground-image: url("${backgroundImageUrl}") !important;`,
			`\tbackground-size: ${size} !important;`,
			`\tbackground-position: ${position} !important;`,
			`\tbackground-repeat: no-repeat !important;`,
			`\topacity: ${clamped} !important;`,
			blurPx ? `\tfilter: blur(${blurPx}px) !important;` : null,
			blurPx ? `\ttransform: scale(1.05) !important;` : null,
			`}`,
			`body { position: relative !important; z-index: 1 !important; background: transparent !important; }`,
			`body[data-cursor-glass-mode="true"],`,
			`body.cursor-glass-os-vibrancy-on,`,
			`body.cursor-glass-os-vibrancy-off {`,
			`\tbackground: transparent !important;`,
			`}`,
			`.monaco-workbench { position: relative !important; z-index: 1 !important; }`,
			/* 直接给 part 上色，避免只改变量仍被实底盖住 */
			`.monaco-workbench .part.activitybar,`,
			`.monaco-workbench .activitybar {`,
			`\tbackground-color: ${chromeRgba} !important;`,
			`}`,
			`.monaco-workbench .part.sidebar,`,
			`.monaco-workbench .part.sidebar > .content,`,
			`.monaco-workbench .part.sidebar .split-view-view,`,
			`.monaco-workbench .sidebar,`,
			`.monaco-workbench .composite.viewlet,`,
			`.agent-sidebar,`,
			`.unified-agents-sidebar,`,
			`.unified-agents-sidebar-content,`,
			`.unified-agents-sidebar__center {`,
			`\tbackground-color: ${panelRgba} !important;`,
			`}`,
			`.agent-sidebar,`,
			`.unified-agents-sidebar {`,
			`\tbackground: ${panelRgba} !important;`,
			`\t--vscode-sideBar-background: ${panelRgba} !important;`,
			`\t--cursor-bg-sidebar: ${panelRgba} !important;`,
			`}`,
			`.agent-window,`,
			`.agent-window .monaco-workbench,`,
			`.agent-window .part.editor,`,
			`.agent-window .part.editor > .content,`,
			`.agent-window .editor-group-container {`,
			`\tbackground-color: ${editorRgba} !important;`,
			`}`,
			`.monaco-workbench .part.editor,`,
			`.monaco-workbench .part.editor > .content,`,
			`.monaco-workbench .part.editor > .content .editor-group-container,`,
			`.monaco-workbench .part.editor > .content .editor-group-container.empty,`,
			`.monaco-workbench .part.editor > .content .grid-view-container,`,
			`.monaco-workbench .editor-group-container > .editor-container,`,
			`.monaco-workbench .editor-instance {`,
			`\tbackground-color: ${editorRgba} !important;`,
			`}`,
			`.monaco-workbench .part.editor > .content .editor-group-container.empty {`,
			`\topacity: 1 !important;`,
			`}`,
			`.monaco-editor,`,
			`.monaco-editor-background,`,
			`.monaco-editor .margin,`,
			`.monaco-editor .inputarea.ime-input {`,
			`\tbackground-color: transparent !important;`,
			`}`,
			`.monaco-editor .sticky-widget,`,
			`.monaco-editor .sticky-line-content {`,
			`\tbackground-color: ${hexToRgba(backgroundColor, 0.45)} !important;`,
			`}`,
			`.cursor-settings-pane-outer-wrapper {`,
			`\tbackground-color: ${editorRgba} !important;`,
			`}`,
			/* 右侧 Agent / Composer：多层 glass 表面，必须直接覆盖 */
			`.monaco-workbench .part.auxiliarybar,`,
			`.monaco-workbench .part.auxiliarybar > .content,`,
			`.monaco-workbench .part.auxiliarybar .split-view-view,`,
			`.monaco-workbench .part.auxiliarybar .pane-body,`,
			`.agent-layout,`,
			`.agent-panel,`,
			`.agent-panel .agent-panel-conversation-mask,`,
			`.agent-panel .agent-panel-conversation-shell,`,
			`.agent-panel .glass-agent-conversation-tiling,`,
			`.agent-panel .glass-agent-conversation-tiling .ui-tiling-panel,`,
			`.agent-panel .glass-agent-conversation-tiling__header,`,
			`.composer-bar,`,
			`.composer-bar.editor,`,
			`.composer-bar.editor .conversations,`,
			`.composer-messages-container,`,
			`.editor-container .composer-bar.editor {`,
			`\tbackground: ${editorRgba} !important;`,
			`\tbackground-color: ${editorRgba} !important;`,
			`}`,
			`.monaco-workbench .part.auxiliarybar,`,
			`.agent-layout,`,
			`.agent-panel,`,
			`.composer-bar.editor {`,
			`\t--composer-pane-background: ${editorRgba} !important;`,
			`\t--glass-chat-surface-background: ${editorRgba} !important;`,
			`\t--glass-editor-surface-background: ${editorRgba} !important;`,
			`\t--glass-vibrancy-on-surface-background: ${editorRgba} !important;`,
			`\t--cursor-bg-chrome: ${editorRgba} !important;`,
			`\t--cursor-bg-editor: ${editorRgba} !important;`,
			`\t--vscode-editor-background: ${editorRgba} !important;`,
			`}`,
			/* 气泡略实一点，保证字可读；背后表面透壁纸 */
			`.agent-panel,`,
			`.composer-bar.editor {`,
			`\t--glass-chat-bubble-background: ${hexToRgba(backgroundColor, Math.min(1, editor + 0.35))} !important;`,
			`\t--glass-chat-bubble-opaque-background: ${hexToRgba(backgroundColor, Math.min(1, editor + 0.45))} !important;`,
			`}`
		);
	}

	if (customCss && customCss.trim()) {
		blocks.push('/* cursorSkin.customCss */', customCss.trim());
	}

	return blocks.filter((line) => line != null).join('\n') + '\n';
}

function refreshChecksum(appRoot, fixChecksums) {
	if (!fixChecksums) {
		return false;
	}
	const { product } = workbenchPaths(appRoot);
	const raw = JSON.parse(fs.readFileSync(product, 'utf8'));
	if (!raw.checksums || !(WORKBENCH_REL in raw.checksums)) {
		return false;
	}
	const target = path.join(appRoot, 'out', ...WORKBENCH_REL.split('/'));
	const next = checksum(target);
	if (raw.checksums[WORKBENCH_REL] === next) {
		return false;
	}
	raw.checksums[WORKBENCH_REL] = next;
	fs.writeFileSync(product, JSON.stringify(raw, null, '\t') + '\n', 'utf8');
	return true;
}

function apply(appRoot, options) {
	const paths = workbenchPaths(appRoot);
	const original = fs.readFileSync(paths.html, 'utf8');
	const clean = stripInjection(original);
	const previousCss = fs.existsSync(paths.css) ? fs.readFileSync(paths.css, 'utf8') : null;
	const menuJsSrc = path.join(__dirname, '..', 'media', MENU_JS_NAME);
	const menuJsTarget = path.join(paths.dir, MENU_JS_NAME);
	let menuJsContent = null;
	if (fs.existsSync(menuJsSrc)) {
		menuJsContent = fs.readFileSync(menuJsSrc, 'utf8');
	}
	const previousMenuJs = fs.existsSync(menuJsTarget) ? fs.readFileSync(menuJsTarget, 'utf8') : null;

	if (!fs.existsSync(paths.backup)) {
		fs.writeFileSync(paths.backup, clean, 'utf8');
	}

	// 先算好目标内容，再决定要不要写盘，避免每次启动都“假变更”
	const bg = resolveBackground(options && options.backgroundImage, paths.dir);
	const css = buildCss({ ...(options || {}), backgroundImageUrl: bg.url });

	const headInjection =
		`\t\t${START_MARK}` +
		`<link rel="stylesheet" href="./${CSS_NAME}">` +
		(menuJsContent ? `<script src="./${MENU_JS_NAME}"></script>` : '') +
		`${END_MARK}\n`;
	const bodyInjection = bg.url
		? `\t\t${BODY_START}<div id="${WALLPAPER_ID}"></div>${BODY_END}\n`
		: '';

	let nextHtml = clean.replace('</head>', `${headInjection}\t</head>`);
	if (nextHtml === clean) {
		throw new Error('workbench.html 中找不到 </head>，无法注入样式。');
	}
	if (bodyInjection) {
		nextHtml = nextHtml.replace(
			/<body([^>]*)>[\s\S]*?<\/body>/,
			`<body$1>\n${bodyInjection}\t</body>`
		);
	}

	const htmlChanged = nextHtml !== original;
	const cssChanged = previousCss !== css;
	const menuJsChanged = menuJsContent != null && previousMenuJs !== menuJsContent;

	if (cssChanged) {
		fs.writeFileSync(paths.css, css, 'utf8');
	}
	if (menuJsChanged) {
		fs.writeFileSync(menuJsTarget, menuJsContent, 'utf8');
	}
	if (htmlChanged) {
		fs.writeFileSync(paths.html, nextHtml, 'utf8');
	}
	const checksumChanged = refreshChecksum(appRoot, options && options.fixChecksums);

	return {
		htmlChanged,
		cssChanged,
		menuJsChanged,
		checksumChanged,
		changed: htmlChanged || cssChanged || menuJsChanged,
		backgroundImageUrl: bg.url
			? bg.url.startsWith('data:')
				? `data:(${Math.round(bg.url.length / 1024)}KB)`
				: bg.url
			: null,
		staged: bg.staged,
		paths
	};
}

function remove(appRoot, options) {
	const paths = workbenchPaths(appRoot);
	const original = fs.readFileSync(paths.html, 'utf8');
	const clean = stripInjection(original);
	const htmlChanged = clean !== original;

	if (htmlChanged) {
		fs.writeFileSync(paths.html, clean, 'utf8');
	}
	clearStagedBackgrounds(paths.dir);
	if (fs.existsSync(paths.backup)) {
		fs.unlinkSync(paths.backup);
	}
	const checksumChanged = refreshChecksum(appRoot, options && options.fixChecksums);

	return { htmlChanged, cssRemoved: true, checksumChanged, changed: htmlChanged, paths };
}

function isPatched(appRoot) {
	const paths = workbenchPaths(appRoot);
	if (!fs.existsSync(paths.html)) {
		return false;
	}
	return fs.readFileSync(paths.html, 'utf8').includes(START_MARK);
}

function currentCss(appRoot) {
	const paths = workbenchPaths(appRoot);
	return fs.existsSync(paths.css) ? fs.readFileSync(paths.css, 'utf8') : null;
}

module.exports = {
	resolveAppRoot,
	workbenchPaths,
	buildCss,
	apply,
	remove,
	isPatched,
	currentCss,
	checksum,
	CSS_NAME,
	BG_BASENAME
};
