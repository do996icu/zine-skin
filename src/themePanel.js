'use strict';

const vscode = require('vscode');
const i18n = require('./i18n');

const SECTION = 'cursorSkin';
const VIEW_TYPE = 'cursorSkin.themeSettings';

let currentPanel;

function getConfigSnapshot() {
	const cfg = vscode.workspace.getConfiguration(SECTION);
	return {
		enabled: cfg.get('enabled', true),
		backgroundImage: cfg.get('backgroundImage', ''),
		opacity: cfg.get('opacity', 0.4),
		blur: cfg.get('blur', 0),
		size: cfg.get('size', 'cover'),
		position: cfg.get('position', 'center center'),
		accentColor: cfg.get('accentColor', '#7C9EF6'),
		backgroundColor: cfg.get('backgroundColor', '#0F1115'),
		panelOpacity: cfg.get('panelOpacity', 0.82),
		editorOpacity: cfg.get('editorOpacity', 0.7),
		customCss: cfg.get('customCss', '')
	};
}

async function updateSetting(key, value) {
	await vscode.workspace
		.getConfiguration(SECTION)
		.update(key, value, vscode.ConfigurationTarget.Global);
}

function buildHtml(webview, nonce) {
	const cfg = getConfigSnapshot();
	const L = i18n.all();
	const csp = [
		`default-src 'none'`,
		`style-src ${webview.cspSource} 'unsafe-inline'`,
		`script-src 'nonce-${nonce}'`,
		`img-src ${webview.cspSource} https: data: file:`
	].join('; ');

	return `<!DOCTYPE html>
<html lang="${L.locale}">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="${csp}"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${escapeHtml(L.panelTitle)}</title>
<style>
  :root {
    --bg: var(--vscode-editor-background);
    --fg: var(--vscode-foreground);
    --muted: var(--vscode-descriptionForeground);
    --border: var(--vscode-widget-border, #444);
    --input-bg: var(--vscode-input-background);
    --input-fg: var(--vscode-input-foreground);
    --btn-bg: var(--vscode-button-background);
    --btn-fg: var(--vscode-button-foreground);
    --btn-hover: var(--vscode-button-hoverBackground);
    --sec-bg: var(--vscode-sideBar-background);
    --accent: ${escapeHtml(cfg.accentColor)};
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px 28px 48px;
    font-family: var(--vscode-font-family);
    font-size: 13px;
    color: var(--fg);
    background: transparent;
  }
  h1 {
    margin: 0 0 4px;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .sub { color: var(--muted); margin-bottom: 24px; }
  .section {
    background: color-mix(in srgb, var(--sec-bg) 70%, transparent);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
    margin-bottom: 14px;
  }
  .section h2 {
    margin: 0 0 14px;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    font-weight: 600;
  }
  .row {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 12px;
    align-items: center;
    margin-bottom: 12px;
  }
  .row:last-child { margin-bottom: 0; }
  label { color: var(--fg); }
  input[type="text"], input[type="number"], select, textarea {
    width: 100%;
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--input-fg);
    font: inherit;
  }
  textarea { min-height: 88px; resize: vertical; font-family: var(--vscode-editor-font-family, monospace); }
  input[type="color"] {
    width: 48px; height: 32px; padding: 0; border: 1px solid var(--border); border-radius: 6px; background: transparent;
  }
  input[type="range"] { width: 100%; }
  .color-line { display: flex; gap: 10px; align-items: center; }
  .color-line input[type="text"] { flex: 1; }
  .path-line { display: flex; gap: 8px; align-items: center; }
  .path-line input { flex: 1; }
  .val { color: var(--muted); font-variant-numeric: tabular-nums; min-width: 42px; text-align: right; }
  .range-line { display: flex; gap: 10px; align-items: center; }
  .btns { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 18px; }
  button {
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    font: inherit;
    cursor: pointer;
    background: var(--btn-bg);
    color: var(--btn-fg);
  }
  button:hover { background: var(--btn-hover); }
  button.secondary {
    background: transparent;
    color: var(--fg);
    border: 1px solid var(--border);
  }
  .switch {
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .hint { margin-top: 12px; color: var(--muted); font-size: 12px; }
  .preview {
    height: 72px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background-color: ${escapeHtml(cfg.backgroundColor)};
    background-image: ${cfg.backgroundImage ? `url("${escapeAttr(toPreviewUrl(cfg.backgroundImage))}")` : 'none'};
    background-size: ${escapeHtml(cfg.size)};
    background-position: ${escapeHtml(cfg.position)};
    opacity: ${Number(cfg.opacity)};
  }
</style>
</head>
<body>
  <h1>${escapeHtml(L.heading)}</h1>
  <p class="sub">${escapeHtml(L.subtitle)}</p>

  <div class="section">
    <h2>${escapeHtml(L.sectionBasic)}</h2>
    <div class="row">
      <label for="enabled">${escapeHtml(L.enabled)}</label>
      <label class="switch">
        <input id="enabled" type="checkbox" ${cfg.enabled ? 'checked' : ''}/>
      </label>
    </div>
    <div class="row">
      <label for="backgroundImage">${escapeHtml(L.backgroundImage)}</label>
      <div class="path-line">
        <input id="backgroundImage" type="text" value="${escapeAttr(cfg.backgroundImage)}"/>
        <button type="button" class="secondary" id="pickImage">${escapeHtml(L.pickImage)}</button>
        <button type="button" class="secondary" id="clearImage">${escapeHtml(L.clearImage)}</button>
      </div>
    </div>
    <div class="preview" id="preview"></div>
  </div>

  <div class="section">
    <h2>${escapeHtml(L.sectionColors)}</h2>
    <div class="row">
      <label>${escapeHtml(L.accentColor)}</label>
      <div class="color-line">
        <input id="accentColorPicker" type="color" value="${escapeAttr(normalizeHex(cfg.accentColor))}"/>
        <input id="accentColor" type="text" value="${escapeAttr(cfg.accentColor)}"/>
      </div>
    </div>
    <div class="row">
      <label>${escapeHtml(L.backgroundColor)}</label>
      <div class="color-line">
        <input id="backgroundColorPicker" type="color" value="${escapeAttr(normalizeHex(cfg.backgroundColor))}"/>
        <input id="backgroundColor" type="text" value="${escapeAttr(cfg.backgroundColor)}"/>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>${escapeHtml(L.sectionOpacity)}</h2>
    <div class="row">
      <label for="opacity">${escapeHtml(L.opacity)}</label>
      <div class="range-line">
        <input id="opacity" type="range" min="0" max="1" step="0.01" value="${Number(cfg.opacity)}"/>
        <span class="val" id="opacityVal">${Number(cfg.opacity).toFixed(2)}</span>
      </div>
    </div>
    <div class="row">
      <label for="panelOpacity">${escapeHtml(L.panelOpacity)}</label>
      <div class="range-line">
        <input id="panelOpacity" type="range" min="0" max="1" step="0.01" value="${Number(cfg.panelOpacity)}"/>
        <span class="val" id="panelOpacityVal">${Number(cfg.panelOpacity).toFixed(2)}</span>
      </div>
    </div>
    <div class="row">
      <label for="editorOpacity">${escapeHtml(L.editorOpacity)}</label>
      <div class="range-line">
        <input id="editorOpacity" type="range" min="0" max="1" step="0.01" value="${Number(cfg.editorOpacity)}"/>
        <span class="val" id="editorOpacityVal">${Number(cfg.editorOpacity).toFixed(2)}</span>
      </div>
    </div>
    <div class="row">
      <label for="blur">${escapeHtml(L.blur)}</label>
      <input id="blur" type="number" min="0" max="60" step="1" value="${Number(cfg.blur)}"/>
    </div>
    <div class="row">
      <label for="size">${escapeHtml(L.size)}</label>
      <select id="size">
        ${['cover', 'contain', 'auto', '100% 100%']
					.map(
						(s) =>
							`<option value="${escapeAttr(s)}" ${cfg.size === s ? 'selected' : ''}>${escapeHtml(s)}</option>`
					)
					.join('')}
      </select>
    </div>
    <div class="row">
      <label for="position">${escapeHtml(L.position)}</label>
      <input id="position" type="text" value="${escapeAttr(cfg.position)}"/>
    </div>
  </div>

  <div class="section">
    <h2>${escapeHtml(L.sectionAdvanced)}</h2>
    <div class="row" style="grid-template-columns: 160px 1fr; align-items: start;">
      <label for="customCss">${escapeHtml(L.customCss)}</label>
      <textarea id="customCss">${escapeHtml(cfg.customCss)}</textarea>
    </div>
  </div>

  <div class="btns">
    <button type="button" id="apply">${escapeHtml(L.apply)}</button>
  </div>
  <p class="hint">${escapeHtml(L.hintReload)}</p>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);

  function bindRange(id, valId) {
    const el = $(id);
    const val = $(valId);
    el.addEventListener('input', () => { val.textContent = Number(el.value).toFixed(2); refreshPreview(); });
  }
  bindRange('opacity', 'opacityVal');
  bindRange('panelOpacity', 'panelOpacityVal');
  bindRange('editorOpacity', 'editorOpacityVal');

  function syncColor(textId, pickerId) {
    const text = $(textId);
    const picker = $(pickerId);
    text.addEventListener('change', () => {
      const v = text.value.trim();
      if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
        picker.value = v.startsWith('#') ? v : ('#' + v);
      }
      refreshPreview();
    });
    picker.addEventListener('input', () => {
      text.value = picker.value;
      refreshPreview();
    });
  }
  syncColor('accentColor', 'accentColorPicker');
  syncColor('backgroundColor', 'backgroundColorPicker');

  ['backgroundImage','size','position','blur'].forEach((id) => {
    $(id).addEventListener('change', refreshPreview);
    $(id).addEventListener('input', refreshPreview);
  });

  function refreshPreview() {
    const p = $('preview');
    const img = $('backgroundImage').value.trim();
    p.style.backgroundColor = $('backgroundColor').value || '#0F1115';
    p.style.backgroundImage = img ? ('url("' + img.replace(/"/g, '') + '")') : 'none';
    p.style.backgroundSize = $('size').value;
    p.style.backgroundPosition = $('position').value;
    p.style.opacity = $('opacity').value;
  }

  $('pickImage').addEventListener('click', () => vscode.postMessage({ type: 'pickImage' }));
  $('clearImage').addEventListener('click', () => {
    $('backgroundImage').value = '';
    refreshPreview();
    // 清空后立刻保存并应用，避免只清输入框、旧 CSS 里的壁纸仍残留
    $('apply').click();
  });
  $('apply').addEventListener('click', () => {
    vscode.postMessage({
      type: 'save',
      payload: {
        enabled: $('enabled').checked,
        backgroundImage: $('backgroundImage').value.trim(),
        opacity: Number($('opacity').value),
        blur: Number($('blur').value),
        size: $('size').value,
        position: $('position').value.trim(),
        accentColor: $('accentColor').value.trim(),
        backgroundColor: $('backgroundColor').value.trim(),
        panelOpacity: Number($('panelOpacity').value),
        editorOpacity: Number($('editorOpacity').value),
        customCss: $('customCss').value
      }
    });
  });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg && msg.type === 'config' && msg.payload) {
      const c = msg.payload;
      $('enabled').checked = !!c.enabled;
      $('backgroundImage').value = c.backgroundImage || '';
      $('opacity').value = c.opacity;
      $('opacityVal').textContent = Number(c.opacity).toFixed(2);
      $('blur').value = c.blur;
      $('size').value = c.size;
      $('position').value = c.position;
      $('accentColor').value = c.accentColor;
      $('accentColorPicker').value = c.accentColor;
      $('backgroundColor').value = c.backgroundColor;
      $('backgroundColorPicker').value = c.backgroundColor;
      $('panelOpacity').value = c.panelOpacity;
      $('panelOpacityVal').textContent = Number(c.panelOpacity).toFixed(2);
      $('editorOpacity').value = c.editorOpacity;
      $('editorOpacityVal').textContent = Number(c.editorOpacity).toFixed(2);
      $('customCss').value = c.customCss || '';
      refreshPreview();
    }
  });
</script>
</body>
</html>`;
}

function escapeHtml(s) {
	return String(s == null ? '' : s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function escapeAttr(s) {
	return escapeHtml(s).replace(/'/g, '&#39;');
}

function normalizeHex(v) {
	const s = String(v || '').trim();
	if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
	if (/^[0-9a-fA-F]{6}$/.test(s)) return `#${s}`;
	return '#7C9EF6';
}

function toPreviewUrl(pathOrUrl) {
	// webview may not load file://; keep path for display, preview may be blank for local files
	return String(pathOrUrl || '').replace(/\\/g, '/');
}

function nonce() {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let out = '';
	for (let i = 0; i < 32; i++) {
		out += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return out;
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {{ onApplied?: () => Promise<void> }} hooks
 */
function openThemeSettings(context, hooks = {}) {
	if (currentPanel) {
		currentPanel.reveal(vscode.ViewColumn.One);
		currentPanel.webview.postMessage({ type: 'config', payload: getConfigSnapshot() });
		return currentPanel;
	}

	const panel = vscode.window.createWebviewPanel(
		VIEW_TYPE,
		i18n.t('panelTitle'),
		vscode.ViewColumn.One,
		{
			enableScripts: true,
			retainContextWhenHidden: true
		}
	);
	currentPanel = panel;
	panel.webview.html = buildHtml(panel.webview, nonce());

	panel.onDidDispose(
		() => {
			currentPanel = undefined;
		},
		null,
		context.subscriptions
	);

	panel.webview.onDidReceiveMessage(
		async (message) => {
			if (!message || !message.type) {
				return;
			}
			if (message.type === 'pickImage') {
				await vscode.commands.executeCommand('cursorSkin.pickImage');
				panel.webview.postMessage({ type: 'config', payload: getConfigSnapshot() });
				return;
			}
			if (message.type === 'save' && message.payload) {
				const p = message.payload;
				const keys = [
					'enabled',
					'backgroundImage',
					'opacity',
					'blur',
					'size',
					'position',
					'accentColor',
					'backgroundColor',
					'panelOpacity',
					'editorOpacity',
					'customCss'
				];
				for (const key of keys) {
					if (p[key] !== undefined) {
						await updateSetting(key, p[key]);
					}
				}
				if (hooks.onApplied) {
					await hooks.onApplied();
				}
				vscode.window.showInformationMessage(i18n.t('applied'));
				panel.webview.postMessage({ type: 'config', payload: getConfigSnapshot() });
			}
		},
		undefined,
		context.subscriptions
	);

	return panel;
}

module.exports = { openThemeSettings, getConfigSnapshot };
