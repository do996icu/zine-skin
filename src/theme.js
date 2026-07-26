'use strict';

/**
 * 从 Cursor Dark 基础主题派生出皮肤配色：
 * 语法高亮（tokenColors）原样保留，只重写工作台的底色与主题色。
 */

const DEFAULTS = {
	name: 'Skin Dark',
	accent: '#7C9EF6',
	background: '#0F1115',
	panelOpacity: 0.82,
	editorOpacity: 0.7
};

function parseHex(input, fallback) {
	const raw = String(input || '').trim().replace(/^#/, '');
	if (!/^[0-9a-fA-F]{3,8}$/.test(raw)) {
		return fallback ? parseHex(fallback) : { r: 0, g: 0, b: 0, a: 1 };
	}
	let hex = raw;
	if (hex.length === 3 || hex.length === 4) {
		hex = hex.split('').map((c) => c + c).join('');
	}
	return {
		r: parseInt(hex.slice(0, 2), 16),
		g: parseInt(hex.slice(2, 4), 16),
		b: parseInt(hex.slice(4, 6), 16),
		a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
	};
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function toHex({ r, g, b }, alpha) {
	const channel = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
	const base = `#${channel(r)}${channel(g)}${channel(b)}`;
	if (alpha === undefined || alpha >= 1) {
		return base;
	}
	return base + channel(clamp(alpha, 0, 1) * 255);
}

function mix(a, b, t) {
	const c1 = parseHex(a);
	const c2 = parseHex(b);
	return {
		r: c1.r + (c2.r - c1.r) * t,
		g: c1.g + (c2.g - c1.g) * t,
		b: c1.b + (c2.b - c1.b) * t
	};
}

const lighten = (color, t) => mix(color, '#ffffff', t);
const darken = (color, t) => mix(color, '#000000', t);

function buildTheme(base, options) {
	const opts = { ...DEFAULTS, ...(options || {}) };
	const accent = toHex(parseHex(opts.accent, DEFAULTS.accent));
	const bg = toHex(parseHex(opts.background, DEFAULTS.background));
	const panelA = clamp(Number(opts.panelOpacity), 0, 1);
	const editorA = clamp(Number(opts.editorOpacity), 0, 1);

	const chrome = darken(bg, 0.25);
	const surface = lighten(bg, 0.05);
	const accentSoft = (alpha) => toHex(parseHex(accent), alpha);

	const colors = { ...base.colors };

	// 编辑器层：透出背景图最多的区域
	const editorLevel = {
		'editor.background': toHex(parseHex(bg), editorA),
		'editorPane.background': toHex(parseHex(bg), editorA),
		'editorGutter.background': toHex(parseHex(bg), editorA),
		'editorGroup.emptyBackground': toHex(parseHex(bg), editorA),
		'minimap.background': toHex(parseHex(bg), editorA * 0.6),
		'breadcrumb.background': toHex(parseHex(bg), editorA),
		'editorStickyScroll.background': toHex(parseHex(bg), editorA),
		'tab.activeBackground': toHex(parseHex(bg), editorA),
		'tab.unfocusedActiveBackground': toHex(parseHex(bg), editorA),
		'panel.background': toHex(parseHex(bg), editorA),
		'terminal.background': toHex(parseHex(bg), editorA)
	};

	// 外围面板层：稍不透明一点，保证控件可读
	const panelLevel = {
		'sideBar.background': toHex(chrome, panelA),
		'sideBarTitle.background': toHex(chrome, panelA),
		'sideBarSectionHeader.background': toHex(chrome, panelA),
		'activityBar.background': toHex(chrome, panelA),
		'activityBarTop.background': toHex(chrome, panelA),
		'titleBar.activeBackground': toHex(chrome, panelA),
		'titleBar.inactiveBackground': toHex(chrome, panelA),
		'statusBar.background': toHex(chrome, panelA),
		'statusBar.noFolderBackground': toHex(chrome, panelA),
		'statusBar.debuggingBackground': toHex(chrome, panelA),
		'editorGroupHeader.tabsBackground': toHex(chrome, panelA),
		'editorGroupHeader.noTabsBackground': toHex(chrome, panelA),
		'tab.inactiveBackground': toHex(chrome, panelA),
		'tab.unfocusedInactiveBackground': toHex(chrome, panelA),
		'panelSectionHeader.background': toHex(chrome, panelA),
		'banner.background': toHex(chrome, panelA)
	};

	// 浮层保持完全不透明，否则弹窗上的文字会糊在背景图上
	const overlayLevel = {
		'editorWidget.background': toHex(surface),
		'editorHoverWidget.background': toHex(surface),
		'editorSuggestWidget.background': toHex(surface),
		'debugToolBar.background': toHex(surface),
		'peekViewEditor.background': toHex(darken(bg, 0.1)),
		'peekViewResult.background': toHex(chrome),
		'quickInput.background': toHex(surface),
		'dropdown.background': toHex(surface),
		'menu.background': toHex(surface),
		'notifications.background': toHex(surface),
		'notificationCenterHeader.background': toHex(chrome),
		'commandCenter.background': toHex(chrome, panelA)
	};

	// 主题色：所有强调、焦点与选中态
	const accents = {
		focusBorder: accentSoft(0.6),
		'button.background': accent,
		'button.foreground': '#0B0D11',
		'button.hoverBackground': toHex(lighten(accent, 0.15)),
		'button.secondaryBackground': toHex(lighten(bg, 0.12)),
		'badge.background': accent,
		'badge.foreground': '#0B0D11',
		'activityBarBadge.background': accent,
		'activityBarBadge.foreground': '#0B0D11',
		'activityBar.activeBorder': accent,
		'activityBarTop.activeBorder': accent,
		'progressBar.background': accent,
		'textLink.foreground': toHex(lighten(accent, 0.1)),
		'textLink.activeForeground': toHex(lighten(accent, 0.25)),
		'notificationLink.foreground': toHex(lighten(accent, 0.1)),
		'editorLink.activeForeground': toHex(lighten(accent, 0.1)),
		'editorCursor.foreground': accent,
		'terminalCursor.foreground': accent,
		'editor.selectionBackground': accentSoft(0.28),
		'editor.inactiveSelectionBackground': accentSoft(0.16),
		'editor.selectionHighlightBackground': accentSoft(0.18),
		'editor.wordHighlightBackground': accentSoft(0.16),
		'editor.wordHighlightStrongBackground': accentSoft(0.24),
		'editor.findMatchBackground': accentSoft(0.4),
		'editor.findMatchHighlightBackground': accentSoft(0.22),
		'selection.background': accentSoft(0.35),
		'list.activeSelectionBackground': accentSoft(0.22),
		'list.activeSelectionForeground': '#FFFFFF',
		'list.inactiveSelectionBackground': accentSoft(0.12),
		'list.hoverBackground': accentSoft(0.08),
		'list.highlightForeground': toHex(lighten(accent, 0.15)),
		'list.focusOutline': accentSoft(0.5),
		'list.dropBackground': accentSoft(0.15),
		'menu.selectionBackground': accentSoft(0.25),
		'quickInputList.focusBackground': accentSoft(0.22),
		'pickerGroup.foreground': toHex(lighten(accent, 0.1)),
		'tab.activeBorderTop': accent,
		'tab.unfocusedActiveBorderTop': accentSoft(0.4),
		'panelTitle.activeBorder': accent,
		'statusBarItem.remoteBackground': accent,
		'statusBarItem.remoteForeground': '#0B0D11',
		'statusBarItem.prominentBackground': accentSoft(0.35),
		'inputOption.activeBackground': accentSoft(0.28),
		'inputOption.activeBorder': accentSoft(0.7),
		'inputOption.activeForeground': '#FFFFFF',
		'inputValidation.infoBorder': accentSoft(0.7),
		'sash.hoverBorder': accentSoft(0.7),
		'scrollbarSlider.activeBackground': accentSoft(0.5),
		'settings.modifiedItemIndicator': accent,
		'settings.headerForeground': '#FFFFFF',
		'editorSuggestWidget.highlightForeground': toHex(lighten(accent, 0.15)),
		'editorSuggestWidget.focusHighlightForeground': toHex(lighten(accent, 0.25)),
		'editorSuggestWidget.selectedBackground': accentSoft(0.22),
		'peekView.border': accentSoft(0.6),
		'panel.border': accentSoft(0.12),
		'sideBar.border': accentSoft(0.1),
		'titleBar.border': accentSoft(0.1),
		'statusBar.border': accentSoft(0.1),
		'editorGroup.border': accentSoft(0.12),
		'contrastActiveBorder': null
	};

	Object.assign(colors, editorLevel, panelLevel, overlayLevel);
	for (const [key, value] of Object.entries(accents)) {
		if (value === null) {
			delete colors[key];
		} else {
			colors[key] = value;
		}
	}

	// 输入框与滚动条跟随底色，避免残留基础主题的灰
	colors['input.background'] = toHex(lighten(bg, 0.08));
	colors['dropdown.border'] = accentSoft(0.15);
	colors['input.border'] = accentSoft(0.15);
	colors['scrollbarSlider.background'] = accentSoft(0.14);
	colors['scrollbarSlider.hoverBackground'] = accentSoft(0.3);
	colors['widget.border'] = accentSoft(0.15);
	colors['editorWidget.border'] = accentSoft(0.15);

	return {
		name: opts.name,
		semanticHighlighting: base.semanticHighlighting !== false,
		semanticTokenColors: base.semanticTokenColors,
		tokenColors: base.tokenColors,
		colors
	};
}

module.exports = { buildTheme, DEFAULTS, parseHex, toHex, mix, lighten, darken };
