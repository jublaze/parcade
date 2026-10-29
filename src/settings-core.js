const sessionSettings = new Map();
const unavailableSettings = new Set();
let dialogSequence = 0;

export function snapshot(value) {
  return Object.freeze(structuredClone(value));
}

export function readSavedConfig(key, source, validate) {
  const cached = sessionSettings.get(key);
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return { config: snapshot(cached ?? source), available: !unavailableSettings.has(key) };
    const parsed = JSON.parse(raw);
    const result = validate(parsed);
    if (result.valid) {
      if (!cached) sessionSettings.set(key, snapshot(result.value));
      return { config: snapshot(sessionSettings.get(key)), available: !unavailableSettings.has(key) };
    }
    return { config: snapshot(cached ?? source), available: false };
  } catch {
    return { config: snapshot(cached ?? source), available: false };
  }
}

export function writeSavedConfig(key, config) {
  sessionSettings.set(key, snapshot(config));
  try { localStorage.setItem(key, JSON.stringify(config)); unavailableSettings.delete(key); return true; }
  catch { unavailableSettings.add(key); return false; }
}

export function mountSettingsNotice(root, initiallyAvailable = true) {
  const notice = document.createElement('div');
  notice.className = 'settings-notice';
  notice.setAttribute('role', 'status');
  notice.setAttribute('aria-live', 'polite');
  notice.hidden = initiallyAvailable;
  notice.innerHTML = '<span>Settings storage is unavailable. Changes are kept in memory for this page session.</span><button type="button" aria-label="Dismiss settings storage notice">×</button>';
  notice.querySelector('button').addEventListener('click', () => { notice.hidden = true; });
  root.append(notice);
  return { show: () => { notice.hidden = false; }, clear: () => { notice.hidden = true; } };
}

export function mountSettingsDialog(root, { title, presets, fields, validate, onApply, onCancel }) {
  const titleId = `settings-title-${++dialogSequence}`;
  const dialog = document.createElement('dialog');
  dialog.className = 'settings-dialog';
  dialog.setAttribute('aria-labelledby', titleId);
  dialog.innerHTML = `<form method="dialog" novalidate class="settings-form"><header><p class="settings-kicker">ARCADE SETTINGS</p><h2 id="${titleId}">${title}</h2><p class="settings-storage" data-settings-storage></p></header><label class="settings-field"><span>Preset</span><select name="preset">${Object.entries(presets).map(([key, value]) => `<option value="${key}">${value.label}</option>`).join('')}</select></label><div class="settings-fields" data-settings-fields></div><p class="settings-error" role="alert" data-settings-error></p><footer><button type="button" class="settings-cancel" data-cancel>Cancel</button><button type="button" class="settings-reset" data-reset>Reset to Source defaults</button><button type="submit" class="settings-apply">Apply settings</button></footer></form>`;
  root.append(dialog);
  const form = dialog.querySelector('form');
  const presetInput = form.elements.preset;
  const fieldsHost = form.querySelector('[data-settings-fields]');
  const error = form.querySelector('[data-settings-error]');
  error.id = `${titleId}-error`;
  const storageNote = form.querySelector('[data-settings-storage]');
  let activeConfig;
  let previousFocus;
  const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  function fill(config) {
    const preset = config.preset in presets ? config.preset : 'custom';
    presetInput.value = preset;
    fieldsHost.innerHTML = fields.map((field) => {
      if (field.type === 'checkbox') return `<label class="settings-check"><input type="checkbox" name="${field.key}" ${config[field.key] ? 'checked' : ''}><span>${field.label}</span></label>`;
      if (field.type === 'multi-checkbox') return `<fieldset class="settings-choice-group" data-settings-group="${field.key}"><legend>${field.label}</legend>${field.options.map((option) => `<label class="settings-check"><input type="checkbox" name="${field.key}" value="${option.value}" ${(config[field.key] ?? []).includes(option.value) ? 'checked' : ''}><span>${option.label}</span></label>`).join('')}</fieldset>`;
      if (field.type === 'select') return `<label class="settings-field"><span>${field.label}</span><select name="${field.key}">${field.options.map((option) => `<option value="${option.value}" ${config[field.key] === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}</select></label>`;
      return `<label class="settings-field"><span>${field.label}</span><input name="${field.key}" type="number" inputmode="numeric" min="${field.min}" max="${field.max}" step="1" value="${escape(config[field.key] ?? '')}" ${field.optional ? '' : 'required'}></label>`;
    }).join('');
    clearError();
  }
  function clearError() {
    error.textContent = '';
    fieldsHost.querySelectorAll('[aria-describedby]').forEach((field) => field.removeAttribute('aria-describedby'));
  }
  function showValidationError(message, fieldName) {
    error.textContent = message;
    const definition = fields.find((field) => field.key === fieldName);
    if (!definition) { presetInput.focus(); return; }
    if (definition.type === 'multi-checkbox') {
      const group = fieldsHost.querySelector(`[data-settings-group="${definition.key}"]`);
      group?.setAttribute('aria-describedby', error.id);
      group?.querySelector('input:not(:disabled)')?.focus();
      return;
    }
    const field = form.elements[fieldName];
    if (field && typeof field.focus === 'function') {
      field.setAttribute?.('aria-describedby', error.id);
      field.focus();
    } else {
      field?.[0]?.focus?.();
    }
  }
  function open(config, { storageAvailable = true } = {}) {
    activeConfig = snapshot(config);
    previousFocus = document.activeElement;
    storageNote.textContent = storageAvailable ? 'Saved on this device.' : 'Browser storage is unavailable; settings will last for this page session.';
    fill(activeConfig);
    dialog.showModal();
    presetInput.focus();
  }
  function close() {
    dialog.close();
    previousFocus?.focus?.();
  }
  function applyPreset(name) {
    const preset = presets[name];
    if (!preset) return;
    fill({ ...preset.values, preset: name });
  }
  presetInput.addEventListener('change', () => applyPreset(presetInput.value));
  fieldsHost.addEventListener('input', () => { presetInput.value = 'custom'; clearError(); });
  fieldsHost.addEventListener('change', () => { presetInput.value = 'custom'; clearError(); });
  form.querySelector('[data-reset]').addEventListener('click', () => applyPreset('source'));
  form.querySelector('[data-cancel]').addEventListener('click', () => { close(); onCancel(); });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const draft = { preset: presetInput.value };
    for (const field of fields) {
      const input = form.elements[field.key];
      draft[field.key] = field.type === 'checkbox' ? input.checked
        : field.type === 'multi-checkbox' ? [...form.querySelectorAll(`[name="${field.key}"]:checked`)].map((item) => item.value)
          : field.type === 'select' ? input.value : input.value;
    }
    const result = validate(draft);
    if (!result.valid) { showValidationError(result.error, result.field); return; }
    const config = snapshot(result.value);
    close();
    onApply(config);
  });
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); onCancel(); });
  return { open, close, get activeConfig() { return activeConfig; } };
}
