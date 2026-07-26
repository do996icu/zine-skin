'use strict';

/**
 * Runtime i18n for webview / messages (package.nls covers contributes.*).
 */
const vscode = require('vscode');

const MESSAGES = {
	en: {
		panelTitle: 'Theme Settings',
		heading: 'Theme',
		subtitle: 'Customize Zine Skin appearance',
		sectionBasic: 'Basics',
		sectionColors: 'Colors',
		sectionOpacity: 'Opacity',
		sectionAdvanced: 'Advanced',
		enabled: 'Enable skin',
		backgroundImage: 'Background image',
		pickImage: 'Browse…',
		clearImage: 'Clear',
		opacity: 'Wallpaper visibility',
		blur: 'Blur (px)',
		size: 'Background size',
		position: 'Background position',
		accentColor: 'Accent color',
		backgroundColor: 'Base color',
		panelOpacity: 'Panel opacity',
		editorOpacity: 'Editor opacity',
		customCss: 'Custom CSS',
		apply: 'Apply',
		applied: 'Theme settings saved. Reload if prompted.',
		hintReload: 'Some changes require reloading the window to take full effect.'
	},
	'zh-cn': {
		panelTitle: '主题设置',
		heading: 'Theme',
		subtitle: '自定义 Zine Skin 外观',
		sectionBasic: '基础',
		sectionColors: '颜色',
		sectionOpacity: '透明度',
		sectionAdvanced: '高级',
		enabled: '启用皮肤',
		backgroundImage: '背景图',
		pickImage: '浏览…',
		clearImage: '清除',
		opacity: '背景图可见度',
		blur: '模糊（px）',
		size: '背景缩放',
		position: '背景定位',
		accentColor: '主题色',
		backgroundColor: '底色',
		panelOpacity: '面板不透明度',
		editorOpacity: '编辑器不透明度',
		customCss: '自定义 CSS',
		apply: '应用',
		applied: '主题设置已保存。如有提示请重载窗口。',
		hintReload: '部分改动需要重载窗口后才会完全生效。'
	}
};

function locale() {
	const lang = String(vscode.env.language || 'en').toLowerCase();
	if (lang.startsWith('zh')) {
		return 'zh-cn';
	}
	return 'en';
}

function t(key) {
	const pack = MESSAGES[locale()] || MESSAGES.en;
	return pack[key] || MESSAGES.en[key] || key;
}

function all() {
	const pack = MESSAGES[locale()] || MESSAGES.en;
	return { ...MESSAGES.en, ...pack, locale: locale() };
}

module.exports = { t, all, locale };
