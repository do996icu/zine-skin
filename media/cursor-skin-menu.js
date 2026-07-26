/**
 * Appearance 菜单顶部叠加 Theme 入口。
 * 性能约束：不能监听整棵 DOM 后全量扫描（Agent 流式输出会卡死）。
 */
(function () {
	'use strict';

	var MARK = 'data-cursor-skin-theme';
	var CMD = 'cursorSkin.openSettings';
	var URI = 'cursor://do996.zine-skin/settings';
	var APPEARANCE_HINTS = ['Zen Mode', '禅模式', 'Full Screen', '全屏', 'Centered Layout', '居中布局', 'Menu Bar', '菜单栏'];
	var VIEW_BLOCKERS = [
		'Command Palette',
		'命令面板',
		'Open View',
		'打开视图',
		'Appearance',
		'外观',
		'Explorer',
		'资源管理器',
		'Editor Layout',
		'编辑器布局'
	];

	var pendingOpen = false;
	var timer = null;
	var muted = false;

	function directLabels(container) {
		var list = container.querySelector('.actions-container');
		if (!list) return [];
		var out = [];
		var kids = list.children;
		for (var i = 0; i < kids.length; i++) {
			var label = kids[i].querySelector && kids[i].querySelector('.action-label');
			if (!label) continue;
			var t = (label.textContent || '').trim();
			if (t && t.indexOf('Theme') !== 0) out.push(t);
		}
		return out;
	}

	function looksLikeAppearance(container) {
		var texts = directLabels(container);
		if (texts.length < 2) return false;
		for (var i = 0; i < VIEW_BLOCKERS.length; i++) {
			for (var j = 0; j < texts.length; j++) {
				if (texts[j].indexOf(VIEW_BLOCKERS[i]) === 0) return false;
			}
		}
		var hit = 0;
		for (var k = 0; k < APPEARANCE_HINTS.length; k++) {
			if (texts.indexOf(APPEARANCE_HINTS[k]) !== -1) hit++;
		}
		return hit >= 2;
	}

	function runCommand() {
		try {
			var api = window.vscode;
			if (api && api.ipcRenderer && typeof api.ipcRenderer.send === 'function') {
				api.ipcRenderer.send('vscode:runAction', { id: CMD, from: 'zine-skin' });
				return true;
			}
		} catch (e) {}
		try {
			var a = document.createElement('a');
			a.href = URI;
			a.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
			document.body.appendChild(a);
			a.click();
			setTimeout(function () {
				if (a.parentNode) a.parentNode.removeChild(a);
			}, 0);
			return true;
		} catch (e2) {}
		return false;
	}

	function closeMenus() {
		try {
			var target =
				document.querySelector('.monaco-workbench .part.editor') ||
				document.querySelector('.monaco-workbench') ||
				document.body;
			var rect = target.getBoundingClientRect();
			var x = Math.max(8, Math.floor(rect.left + 24));
			var y = Math.max(40, Math.floor(rect.top + 48));
			target.dispatchEvent(
				new MouseEvent('mousedown', {
					bubbles: true,
					cancelable: true,
					view: window,
					clientX: x,
					clientY: y,
					button: 0
				})
			);
		} catch (e) {}
	}

	function onActivate(ev) {
		if (ev) {
			ev.preventDefault();
			ev.stopPropagation();
			if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
		}
		if (pendingOpen) return;
		pendingOpen = true;
		closeMenus();
		setTimeout(function () {
			try {
				runCommand();
			} finally {
				setTimeout(function () {
					pendingOpen = false;
				}, 400);
			}
		}, 80);
	}

	function ensureOverlay(menu) {
		if (!menu || menu.getAttribute(MARK + '-host') || !looksLikeAppearance(menu)) return;

		muted = true;
		try {
			menu.setAttribute(MARK + '-host', '1');
			var cs = window.getComputedStyle(menu);
			if (cs.position === 'static') menu.style.position = 'relative';

			var list = menu.querySelector('.actions-container');
			var rowH = 28;
			if (list) {
				var sample = list.querySelector('.action-menu-item') || list.querySelector('.action-item');
				if (sample) rowH = Math.max(26, Math.round(sample.getBoundingClientRect().height) || 28);
				list.style.paddingTop = rowH + 6 + 'px';
			}

			var bar = document.createElement('div');
			bar.setAttribute(MARK, '1');
			bar.setAttribute('role', 'menuitem');
			bar.textContent = 'Theme';
			// 与 Monaco vertical menu 的 .action-label { padding: 0 2em } 对齐
			bar.style.cssText = [
				'position:absolute',
				'top:4px',
				'left:0',
				'right:0',
				'height:' + rowH + 'px',
				'line-height:' + rowH + 'px',
				'padding:0 2em',
				'z-index:2147483647',
				'cursor:default',
				'box-sizing:border-box',
				'font-size:13px',
				'color:var(--vscode-menu-foreground,#ccc)',
				'background:transparent',
				'user-select:none',
				'pointer-events:auto'
			].join(';');

			bar.addEventListener('mouseenter', function () {
				bar.style.background = 'var(--vscode-menu-selectionBackground,#094771)';
				bar.style.color = 'var(--vscode-menu-selectionForeground,#fff)';
			});
			bar.addEventListener('mouseleave', function () {
				bar.style.background = 'transparent';
				bar.style.color = 'var(--vscode-menu-foreground,#ccc)';
			});
			bar.addEventListener(
				'pointerdown',
				function (ev) {
					if (ev.button != null && ev.button !== 0) return;
					onActivate(ev);
				},
				true
			);

			menu.appendChild(bar);
		} finally {
			muted = false;
		}
	}

	function scanMenus(root) {
		var scope = root && root.querySelectorAll ? root : document;
		var menus = scope.querySelectorAll
			? scope.querySelectorAll('.monaco-menu')
			: [];
		if (root && root.classList && root.classList.contains('monaco-menu')) {
			ensureOverlay(root);
		}
		for (var i = 0; i < menus.length; i++) ensureOverlay(menus[i]);
	}

	function nodeMayContainMenu(node) {
		if (!node || node.nodeType !== 1) return false;
		if (node.getAttribute && node.getAttribute(MARK)) return false;
		var cls = node.classList;
		if (cls && (cls.contains('monaco-menu') || cls.contains('monaco-menu-container') || cls.contains('context-view'))) {
			return true;
		}
		// 菜单容器往往是后加的浅层节点；避免对大子树 querySelector
		if (node.childElementCount != null && node.childElementCount <= 20 && node.querySelector) {
			return !!node.querySelector('.monaco-menu, .monaco-menu-container');
		}
		return false;
	}

	function onMutations(mutations) {
		if (muted) return;
		var hit = false;
		for (var i = 0; i < mutations.length && !hit; i++) {
			var m = mutations[i];
			for (var j = 0; j < m.addedNodes.length; j++) {
				if (nodeMayContainMenu(m.addedNodes[j])) {
					hit = true;
					break;
				}
			}
		}
		if (!hit) return;
		if (timer) clearTimeout(timer);
		timer = setTimeout(function () {
			timer = null;
			scanMenus(document);
		}, 50);
	}

	function start() {
		if (!document.body) return;
		var obs = new MutationObserver(onMutations);
		obs.observe(document.body, { childList: true, subtree: true });
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', start);
	} else {
		start();
	}
})();
