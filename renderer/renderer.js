const messagesViewport = document.getElementById('messages-viewport');
const emptyStateTemplate = document.getElementById('empty-state-template');
const tabBarEl = document.getElementById('tab-bar');
const textInput = document.getElementById('text-input');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn');
const captureBtn = document.getElementById('capture-btn');
const eyedropperBtn = document.getElementById('eyedropper-btn');
const homeBtn = document.getElementById('home-btn');
const homeNewChatBtn = document.getElementById('home-new-chat');
const settingsBtn = document.getElementById('settings-btn');
const historyBtn = document.getElementById('history-btn');

const attachmentChip = document.getElementById('attachment-chip');
const attachmentThumb = document.getElementById('attachment-thumb');
const attachmentStatus = document.getElementById('attachment-status');
const attachmentRemove = document.getElementById('attachment-remove');
const toolRemoveBgBtn = document.getElementById('tool-remove-bg');
const toolRemoveBgManualBtn = document.getElementById('tool-remove-bg-manual');
const toolEnhanceBtn = document.getElementById('tool-enhance');

const captureOverlay = document.getElementById('capture-overlay');
const captureCount = document.getElementById('capture-count');
const cancelCaptureBtn = document.getElementById('cancel-capture');

const sessionListEl = document.getElementById('session-list');
const homeEmptyEl = document.getElementById('home-empty');

const settingsOverlay = document.getElementById('settings-overlay');
const settingsCloseBtn = document.getElementById('settings-close');
const hotkeyBadge = document.getElementById('hotkey-badge');
const hotkeyRecordBtn = document.getElementById('hotkey-record');
const hotkeyHint = document.getElementById('hotkey-hint');
const eyedropperHotkeyBadge = document.getElementById('eyedropper-hotkey-badge');
const eyedropperHotkeyRecordBtn = document.getElementById('eyedropper-hotkey-record');
const eyedropperHotkeyHint = document.getElementById('eyedropper-hotkey-hint');
const modelSelect = document.getElementById('model-select');
const widgetCheckbox = document.getElementById('widget-checkbox');
const svSquare = document.getElementById('sv-square');
const svThumb = document.getElementById('sv-thumb');
const hueSlider = document.getElementById('hue-slider');
const themeSwatch = document.getElementById('theme-swatch');
const themeHexInput = document.getElementById('theme-hex');

const questionsOverlay = document.getElementById('questions-overlay');
const questionsFields = document.getElementById('questions-fields');
const questionsCancelBtn = document.getElementById('questions-cancel');
const questionsSendBtn = document.getElementById('questions-send');

const lightboxOverlay = document.getElementById('lightbox-overlay');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxDownload = document.getElementById('lightbox-download');
const lightboxClose = document.getElementById('lightbox-close');

const imageEditorOverlay = document.getElementById('image-editor-overlay');
const editCanvas = document.getElementById('edit-canvas');
const editCtx = editCanvas.getContext('2d', { willReadFrequently: true });
const toleranceSlider = document.getElementById('tolerance-slider');

const colorwheelOverlay = document.getElementById('colorwheel-overlay');
const colorwheelEl = document.getElementById('colorwheel');
const colorwheelDot = document.getElementById('colorwheel-dot');
const colorwheelSwatch = document.getElementById('colorwheel-swatch');
const colorwheelHex = document.getElementById('colorwheel-hex');
const colorwheelClose = document.getElementById('colorwheel-close');

let currentQuestions = null;
let undoStack = [];

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(name).classList.add('active');
}

let tabs = [];
let activeTabId = null;

function makeTabId() {
  return 'tab-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function truncateTitle(text, maxLen) {
  const clean = (text || '').trim().replace(/\s+/g, ' ');
  if (!clean) return 'Nova conversa';
  return clean.length > maxLen ? clean.slice(0, maxLen) + '…' : clean;
}

function scrollTabToBottom(tab) {
  tab.messagesEl.scrollTop = tab.messagesEl.scrollHeight;
}

function hideEmptyState(tab) {
  if (tab.emptyStateEl) tab.emptyStateEl.style.display = 'none';
}

function buildEmptyState(tab) {
  const frag = emptyStateTemplate.content.cloneNode(true);
  const el = frag.querySelector('.empty-state');
  el.querySelectorAll('.suggestion').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (tab.id !== activeTabId) switchToTab(tab.id);
      textInput.value = btn.dataset.text;
      textInput.focus();
      handleSend();
    });
  });
  return el;
}

function createTab({ localId = null, title = null } = {}) {
  const tab = {
    id: makeTabId(),
    localId,
    title: title || 'Nova conversa',
    sending: false,
    pendingImage: null,
    draftText: '',
    messagesEl: document.createElement('div'),
    emptyStateEl: null,
  };
  tab.messagesEl.className = 'tab-messages';
  tab.emptyStateEl = buildEmptyState(tab);
  tab.messagesEl.appendChild(tab.emptyStateEl);
  messagesViewport.appendChild(tab.messagesEl);
  tabs.push(tab);
  renderTabBar();
  return tab;
}

function findTabByLocalId(localId) {
  return localId ? tabs.find((t) => t.localId === localId) : null;
}

function activeTab() {
  return tabs.find((t) => t.id === activeTabId) || null;
}

function renderTabBar() {
  tabBarEl.innerHTML = '';
  tabs.forEach((tab) => {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title;
    const close = document.createElement('span');
    close.className = 'tab-close';
    close.textContent = '✕';
    close.title = 'Fechar aba';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    el.appendChild(title);
    el.appendChild(close);
    el.addEventListener('click', () => switchToTab(tab.id));
    tabBarEl.appendChild(el);
  });
  const addBtn = document.createElement('button');
  addBtn.className = 'tab-add';
  addBtn.title = 'Nova aba';
  addBtn.textContent = '+';
  addBtn.addEventListener('click', () => {
    const tab = createTab();
    switchToTab(tab.id);
  });
  tabBarEl.appendChild(addBtn);
}

function updateInputUIForActiveTab() {
  const tab = activeTab();
  if (!tab) return;
  textInput.value = tab.draftText;
  textInput.style.height = 'auto';
  textInput.style.height = Math.min(textInput.scrollHeight, 120) + 'px';

  if (tab.pendingImage) {
    attachmentThumb.src = tab.pendingImage.previewUrl;
    attachmentStatus.textContent = tab.pendingImage.statusText || '';
    attachmentChip.classList.add('show');
  } else {
    attachmentChip.classList.remove('show');
    attachmentThumb.src = '';
    attachmentStatus.textContent = '';
  }

  const state = tab.sending;
  sendBtn.disabled = state;
  attachBtn.disabled = state;
  captureBtn.disabled = state;
  textInput.disabled = state;
}

function switchToTab(tabId) {
  const prev = activeTab();
  if (prev) prev.draftText = textInput.value;

  activeTabId = tabId;
  tabs.forEach((t) => t.messagesEl.classList.toggle('active', t.id === tabId));
  renderTabBar();
  updateInputUIForActiveTab();
  showScreen('chat-screen');
  const tab = activeTab();
  if (tab) {
    scrollTabToBottom(tab);
    if (!tab.sending) textInput.focus();
  }
}

function closeTab(tabId) {
  const idx = tabs.findIndex((t) => t.id === tabId);
  if (idx === -1) return;
  const [removed] = tabs.splice(idx, 1);
  removed.messagesEl.remove();

  if (tabs.length === 0) {
    const fresh = createTab();
    switchToTab(fresh.id);
    return;
  }

  if (activeTabId === tabId) {
    const next = tabs[Math.min(idx, tabs.length - 1)];
    switchToTab(next.id);
  } else {
    renderTabBar();
  }
}

function cycleTab(direction) {
  if (tabs.length < 2) return;
  const idx = tabs.findIndex((t) => t.id === activeTabId);
  const next = (idx + direction + tabs.length) % tabs.length;
  switchToTab(tabs[next].id);
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Tab') {
    e.preventDefault();
    cycleTab(e.shiftKey ? -1 : 1);
  }
});

function extractQuestionsBlock(text) {
  const m = text.match(/<!--QUESTIONS:([\s\S]*?)-->\s*$/);
  if (!m) return { text, questions: null };
  try {
    const parsed = JSON.parse(m[1]);
    const questions = Array.isArray(parsed) ? parsed : Array.isArray(parsed.questions) ? parsed.questions : null;
    if (!questions || questions.length === 0) return { text, questions: null };
    return { text: text.slice(0, m.index).trim(), questions };
  } catch (e) {
    return { text, questions: null };
  }
}

function addUserRow(tab, text, imagePreviewUrl) {
  hideEmptyState(tab);
  const row = document.createElement('div');
  row.className = 'row user';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  if (imagePreviewUrl) {
    const img = document.createElement('img');
    img.className = 'thumb';
    img.src = imagePreviewUrl;
    img.title = 'Clique para ver em tamanho maior';
    img.addEventListener('click', () => openLightbox(imagePreviewUrl));
    bubble.appendChild(img);
  }
  if (text) {
    const span = document.createElement('span');
    span.textContent = text;
    bubble.appendChild(span);
  }
  row.appendChild(bubble);
  tab.messagesEl.appendChild(row);
  scrollTabToBottom(tab);
}

let lightboxUrl = null;

function imageNameFromPreviewUrl(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop());
  } catch (e) {
    return null;
  }
}

function openLightbox(url) {
  lightboxUrl = url;
  lightboxImg.src = url;
  lightboxOverlay.classList.add('show');
}

lightboxClose.addEventListener('click', () => lightboxOverlay.classList.remove('show'));

lightboxDownload.addEventListener('click', async () => {
  if (!lightboxUrl) return;
  const imageName = imageNameFromPreviewUrl(lightboxUrl);
  if (!imageName) return;
  await window.atelie.downloadImage(imageName);
});

function addAssistantTyping(tab) {
  const row = document.createElement('div');
  row.className = 'row assistant typing-row';
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '🐱';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
  row.appendChild(avatar);
  row.appendChild(bubble);
  tab.messagesEl.appendChild(row);
  scrollTabToBottom(tab);
}

function removeTypingRow(tab) {
  const row = tab.messagesEl.querySelector('.typing-row');
  if (row) row.remove();
}

function renderMessageText(container, text) {
  const parts = text.split(/(\[\[[^\[\]\n]{1,24}\]\])/g);
  for (const part of parts) {
    const m = part.match(/^\[\[([^\[\]\n]{1,24})\]\]$/);
    if (m) {
      const kbd = document.createElement('kbd');
      kbd.className = 'keycap';
      kbd.textContent = m[1];
      container.appendChild(kbd);
    } else if (part) {
      container.appendChild(document.createTextNode(part));
    }
  }
}

function addAssistantRow(tab, rawText, isError) {
  hideEmptyState(tab);
  const { text, questions } = isError ? { text: rawText, questions: null } : extractQuestionsBlock(rawText);

  const row = document.createElement('div');
  row.className = 'row assistant';
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '🐱';
  const bubble = document.createElement('div');
  bubble.className = 'bubble' + (isError ? ' error' : '');
  renderMessageText(bubble, text);
  row.appendChild(avatar);
  row.appendChild(bubble);

  tab.messagesEl.appendChild(row);
  scrollTabToBottom(tab);

  if (questions && tab.id === activeTabId) openQuestionsModal(tab, questions);
}

async function doSend(tab, text, imageMeta) {
  if (tab.sending) return;
  if (!text && !imageMeta) return;

  addUserRow(tab, text, imageMeta ? imageMeta.previewUrl : null);
  const imageName = imageMeta ? imageMeta.name : null;

  tab.sending = true;
  if (tab.id === activeTabId) updateInputUIForActiveTab();
  addAssistantTyping(tab);

  try {
    const res = await window.atelie.sendMessage(tab.localId, text, imageName);
    tab.localId = res.localId || tab.localId;
    removeTypingRow(tab);
    addAssistantRow(tab, res.text, !res.ok);
    if (tab.title === 'Nova conversa' && text) {
      tab.title = truncateTitle(text, 22);
      renderTabBar();
    }
  } catch (e) {
    removeTypingRow(tab);
    addAssistantRow(tab, 'Não consegui enviar sua mensagem. Tenta de novo?', true);
  } finally {
    tab.sending = false;
    if (tab.id === activeTabId) {
      updateInputUIForActiveTab();
      textInput.focus();
    }
  }
}

async function handleSend() {
  const tab = activeTab();
  if (!tab || tab.sending) return;
  const text = textInput.value.trim();
  const imageMeta = tab.pendingImage;
  if (!text && !imageMeta) return;

  textInput.value = '';
  tab.draftText = '';
  textInput.style.height = 'auto';
  clearAttachment(tab);
  await doSend(tab, text, imageMeta);
}

sendBtn.addEventListener('click', handleSend);

textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

textInput.addEventListener('input', () => {
  const tab = activeTab();
  if (tab) tab.draftText = textInput.value;
  textInput.style.height = 'auto';
  textInput.style.height = Math.min(textInput.scrollHeight, 120) + 'px';
});

function setPendingImage(tab, result, statusText) {
  tab.pendingImage = { ...result, statusText };
  if (tab.id === activeTabId) updateInputUIForActiveTab();
}

function clearAttachment(tab) {
  tab.pendingImage = null;
  if (tab.id === activeTabId) updateInputUIForActiveTab();
}

function setToolsDisabled(state) {
  toolRemoveBgBtn.disabled = state;
  toolRemoveBgManualBtn.disabled = state;
  toolEnhanceBtn.disabled = state;
}

attachmentRemove.addEventListener('click', () => {
  const tab = activeTab();
  if (tab) clearAttachment(tab);
});

attachBtn.addEventListener('click', async () => {
  const tab = activeTab();
  if (!tab) return;
  const result = await window.atelie.pickImage();
  if (!result) return;
  setPendingImage(tab, result, '🖼️ imagem anexada');
});

toolRemoveBgBtn.addEventListener('click', async () => {
  const tab = activeTab();
  if (!tab || !tab.pendingImage) return;
  setToolsDisabled(true);
  attachmentStatus.textContent = 'removendo fundo...';
  const res = await window.atelie.removeBackground(tab.pendingImage.name);
  setToolsDisabled(false);
  if (res.ok) {
    setPendingImage(tab, { name: res.name, previewUrl: res.previewUrl }, '🪄 fundo removido ✓');
  } else {
    attachmentStatus.textContent = res.error || 'não consegui remover o fundo';
  }
});

toolEnhanceBtn.addEventListener('click', async () => {
  const tab = activeTab();
  if (!tab || !tab.pendingImage) return;
  setToolsDisabled(true);
  attachmentStatus.textContent = 'melhorando qualidade...';
  const res = await window.atelie.enhanceImage(tab.pendingImage.name);
  setToolsDisabled(false);
  if (res.ok) {
    setPendingImage(tab, { name: res.name, previewUrl: res.previewUrl }, '✨ qualidade melhorada ✓');
  } else {
    attachmentStatus.textContent = res.error || 'não consegui melhorar essa imagem';
  }
});

toolRemoveBgManualBtn.addEventListener('click', async () => {
  const tab = activeTab();
  if (!tab || !tab.pendingImage) return;
  const dataUrl = await window.atelie.loadImageForEditing(tab.pendingImage.name);
  openImageEditor(dataUrl);
});

document.addEventListener('paste', async (e) => {
  if (imageEditorOverlay.classList.contains('show')) return;
  const tab = activeTab();
  if (!tab) return;
  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;
  for (const item of items) {
    if (item.type && item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      const buf = new Uint8Array(await file.arrayBuffer());
      const ext = '.' + (item.type.split('/')[1] || 'png');
      const result = await window.atelie.saveClipboardImage(buf, ext);
      if (result) setPendingImage(tab, result, '📋 imagem colada');
      break;
    }
  }
});

let captureCancelled = false;

function runCountdown(seconds) {
  return new Promise((resolve) => {
    captureCancelled = false;
    captureCount.textContent = seconds;
    captureOverlay.classList.add('show');
    let remaining = seconds;
    const tick = () => {
      remaining -= 1;
      if (captureCancelled) {
        captureOverlay.classList.remove('show');
        resolve(false);
        return;
      }
      if (remaining <= 0) {
        captureOverlay.classList.remove('show');
        resolve(true);
        return;
      }
      captureCount.textContent = remaining;
      setTimeout(tick, 1000);
    };
    setTimeout(tick, 1000);
  });
}

cancelCaptureBtn.addEventListener('click', () => { captureCancelled = true; });

captureBtn.addEventListener('click', async () => {
  const tab = activeTab();
  if (!tab || tab.sending) return;
  const proceed = await runCountdown(3);
  if (!proceed) return;

  const result = await window.atelie.captureScreen();
  if (!result) {
    addAssistantRow(tab, 'Não consegui tirar o print da tela. Pode tentar de novo?', true);
    return;
  }
  setPendingImage(tab, result, '📷 print da tela anexado');
  textInput.focus();
});

window.atelie.onHotkeyCapture((result) => {
  if (!result) return;
  const tab = activeTab();
  if (!tab) return;
  showScreen('chat-screen');
  setPendingImage(tab, result, '📷 print da tela anexado');
});

async function refreshHome() {
  const sessions = await window.atelie.listSessions();
  sessionListEl.innerHTML = '';
  if (sessions.length === 0) {
    homeEmptyEl.style.display = 'block';
    return;
  }
  homeEmptyEl.style.display = 'none';
  sessions.forEach((s) => {
    const card = document.createElement('div');
    card.className = 'session-card';

    const main = document.createElement('button');
    main.className = 'session-card-main';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = s.title;
    const date = document.createElement('span');
    date.className = 'date';
    date.textContent = new Date(s.updatedAt).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    main.appendChild(title);
    main.appendChild(date);
    main.addEventListener('click', () => openSession(s.localId, s.title));

    const del = document.createElement('button');
    del.className = 'session-delete';
    del.title = 'Excluir esta conversa';
    del.textContent = '✕';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Excluir a conversa "${s.title}"? Essa ação não pode ser desfeita.`)) return;
      const openTab = findTabByLocalId(s.localId);
      if (openTab) closeTab(openTab.id);
      await window.atelie.deleteSession(s.localId);
      refreshHome();
    });

    card.appendChild(main);
    card.appendChild(del);
    sessionListEl.appendChild(card);
  });
}

async function openSession(localId, title) {
  const existing = findTabByLocalId(localId);
  if (existing) {
    switchToTab(existing.id);
    return;
  }
  const transcript = await window.atelie.openSession(localId);
  const tab = createTab({ localId, title: title ? truncateTitle(title, 22) : null });
  if (transcript && transcript.length > 0) {
    transcript.forEach((m) => {
      if (m.role === 'user' && m.kind === 'color') addColorCard(tab, m.hex);
      else if (m.role === 'user') addUserRow(tab, m.text, m.imagePreviewUrl);
      else addAssistantRow(tab, m.text, m.error);
    });
  }
  switchToTab(tab.id);
}

function startNewChat() {
  const tab = createTab();
  switchToTab(tab.id);
}

homeBtn.addEventListener('click', async () => {
  await refreshHome();
  showScreen('home-screen');
});
homeNewChatBtn.addEventListener('click', startNewChat);

const historyOverlay = document.getElementById('history-overlay');
const historyCloseBtn = document.getElementById('history-close');
const historyColorsEl = document.getElementById('history-colors');
const historyColorsEmptyEl = document.getElementById('history-colors-empty');
const historyImagesEl = document.getElementById('history-images');
const historyImagesEmptyEl = document.getElementById('history-images-empty');

async function openHistory() {
  const [colors, images] = await Promise.all([
    window.atelie.getColorHistory(),
    window.atelie.getImageHistory(),
  ]);

  historyColorsEl.innerHTML = '';
  historyColorsEmptyEl.style.display = colors.length ? 'none' : 'block';
  colors.forEach((c) => {
    const btn = document.createElement('button');
    btn.className = 'history-color-chip';
    btn.title = 'Ver no círculo cromático';
    const swatch = document.createElement('div');
    swatch.className = 'swatch';
    swatch.style.background = c.hex;
    const hexEl = document.createElement('div');
    hexEl.className = 'hex';
    hexEl.textContent = c.hex.toUpperCase();
    btn.appendChild(swatch);
    btn.appendChild(hexEl);
    btn.addEventListener('click', () => {
      historyOverlay.classList.remove('show');
      openColorWheel(c.hex);
    });
    historyColorsEl.appendChild(btn);
  });

  historyImagesEl.innerHTML = '';
  historyImagesEmptyEl.style.display = images.length ? 'none' : 'block';
  images.forEach((img) => {
    const el = document.createElement('img');
    el.src = img.previewUrl;
    el.title = 'Clique para ver em tamanho maior';
    el.addEventListener('click', () => {
      historyOverlay.classList.remove('show');
      openLightbox(img.previewUrl);
    });
    historyImagesEl.appendChild(el);
  });

  historyOverlay.classList.add('show');
}

historyBtn.addEventListener('click', openHistory);
historyCloseBtn.addEventListener('click', () => historyOverlay.classList.remove('show'));

function humanizeAccelerator(acc) {
  if (!acc) return '(nenhum)';
  return acc.replace('CommandOrControl', 'Ctrl').split('+').join(' + ');
}

function applySettingsToUI(s) {
  hotkeyBadge.textContent = humanizeAccelerator(s.hotkey);
  eyedropperHotkeyBadge.textContent = humanizeAccelerator(s.eyedropperHotkey);
  modelSelect.value = s.model || '';
  widgetCheckbox.checked = !!s.showFloatingWidget;
  applyThemeColor(s.themeColor || '#2F6FED');
  setPickerFromHex(s.themeColor || '#2F6FED');
}

settingsBtn.addEventListener('click', async () => {
  const s = await window.atelie.getSettings();
  applySettingsToUI(s);
  settingsOverlay.classList.add('show');
});
settingsCloseBtn.addEventListener('click', () => settingsOverlay.classList.remove('show'));

modelSelect.addEventListener('change', async () => {
  await window.atelie.setSettings({ model: modelSelect.value || null });
});
widgetCheckbox.addEventListener('change', async () => {
  await window.atelie.setSettings({ showFloatingWidget: widgetCheckbox.checked });
});

function codeToElectronKey(code) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;

  const map = {
    Numpad0: 'num0', Numpad1: 'num1', Numpad2: 'num2', Numpad3: 'num3', Numpad4: 'num4',
    Numpad5: 'num5', Numpad6: 'num6', Numpad7: 'num7', Numpad8: 'num8', Numpad9: 'num9',
    NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult',
    NumpadDivide: 'numdiv', NumpadDecimal: 'numdec', NumpadEnter: 'Return',
    Space: 'Space', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert',
    Tab: 'Tab', Enter: 'Return', Escape: 'Esc',
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
    Equal: 'Plus', Minus: '-',
    BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'",
    Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Backquote: '`',
  };
  return map[code] || null;
}

let activeRecorder = null;

function createHotkeyRecorder({ badgeEl, buttonEl, hintEl, settingsKey, idleHint, successHintMulti, successHintSingle }) {
  const recorder = {
    start() {
      if (activeRecorder && activeRecorder !== recorder) activeRecorder.cancel();
      activeRecorder = recorder;
      badgeEl.textContent = 'pressione a tecla...';
      badgeEl.classList.add('listening');
      hintEl.textContent = idleHint;
    },
    cancel() {
      badgeEl.classList.remove('listening');
    },
    async handleKey(e) {
      const parts = [];
      if (e.ctrlKey) parts.push('CommandOrControl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      if (e.metaKey && !e.ctrlKey) parts.push('Super');

      const key = codeToElectronKey(e.code);
      if (!key) {
        hintEl.textContent = 'Essa tecla não pode ser usada como atalho. Tenta outra.';
        return;
      }
      parts.push(key);
      const accelerator = parts.join('+');
      const noModifier = parts.length === 1;

      activeRecorder = null;
      badgeEl.classList.remove('listening');
      badgeEl.textContent = 'salvando...';

      const res = await window.atelie.setSettings({ [settingsKey]: accelerator });
      if (res.ok) {
        badgeEl.textContent = humanizeAccelerator(accelerator);
        hintEl.textContent = noModifier ? successHintSingle : successHintMulti;
      } else {
        badgeEl.textContent = humanizeAccelerator(res.settings[settingsKey]);
        hintEl.textContent = res.error || 'Não foi possível salvar esse atalho (o Windows pode já estar usando essa tecla).';
      }
    },
  };
  buttonEl.addEventListener('click', () => recorder.start());
  return recorder;
}

document.addEventListener('keydown', (e) => {
  if (!activeRecorder) return;
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
  e.preventDefault();
  activeRecorder.handleKey(e);
});

createHotkeyRecorder({
  badgeEl: hotkeyBadge,
  buttonEl: hotkeyRecordBtn,
  hintEl: hotkeyHint,
  settingsKey: 'hotkey',
  idleHint: 'Pode ser uma combinação (Ex: Ctrl + Shift + D) ou uma tecla única (Ex: + do teclado numérico).',
  successHintMulti: 'Atalho salvo! Ao usar essa combinação, o print é tirado na hora.',
  successHintSingle: 'Atalho salvo! Como é uma tecla única, ela vai disparar o print sempre que for apertada, em qualquer programa.',
});

createHotkeyRecorder({
  badgeEl: eyedropperHotkeyBadge,
  buttonEl: eyedropperHotkeyRecordBtn,
  hintEl: eyedropperHotkeyHint,
  settingsKey: 'eyedropperHotkey',
  idleHint: 'Pode ser uma combinação (Ex: Ctrl + Shift + E) ou uma tecla única.',
  successHintMulti: 'Atalho salvo! Ao usar essa combinação, o conta-gotas abre na hora, em qualquer programa.',
  successHintSingle: 'Atalho salvo! Como é uma tecla única, ela vai abrir o conta-gotas sempre que for apertada, em qualquer programa.',
});

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

function hsvToRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

let pickerHue = 221, pickerSat = 0.79, pickerVal = 0.93;

function applyThemeColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  document.documentElement.style.setProperty('--accent', hex);
  const [h, s, v] = rgbToHsv(...rgb);
  const deep = rgbToHex(...hsvToRgb(h, Math.min(1, s * 1.05), v * 0.72));
  document.documentElement.style.setProperty('--accent-deep', deep);
}

function updateSvBackground() {
  svSquare.style.setProperty('--picker-hue', pickerHue);
}

function setPickerThumbPosition() {
  svThumb.style.left = (pickerSat * 100) + '%';
  svThumb.style.top = ((1 - pickerVal) * 100) + '%';
}

function currentPickerHex() {
  return rgbToHex(...hsvToRgb(pickerHue, pickerSat, pickerVal));
}

function setPickerFromHex(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const [h, s, v] = rgbToHsv(...rgb);
  pickerHue = h; pickerSat = s; pickerVal = v;
  hueSlider.value = Math.round(h);
  updateSvBackground();
  setPickerThumbPosition();
  themeSwatch.style.background = hex;
  themeHexInput.value = hex.toUpperCase();
}

let themeSaveTimer = null;
function commitThemeColor(hex) {
  applyThemeColor(hex);
  themeSwatch.style.background = hex;
  themeHexInput.value = hex.toUpperCase();
  clearTimeout(themeSaveTimer);
  themeSaveTimer = setTimeout(() => window.atelie.setSettings({ themeColor: hex }), 150);
}

function svPointerToValues(clientX, clientY) {
  const r = svSquare.getBoundingClientRect();
  const x = clamp01((clientX - r.left) / r.width);
  const y = clamp01((clientY - r.top) / r.height);
  pickerSat = x;
  pickerVal = 1 - y;
}

let svDragging = false;
svSquare.addEventListener('pointerdown', (e) => {
  svDragging = true;
  svSquare.setPointerCapture(e.pointerId);
  svPointerToValues(e.clientX, e.clientY);
  setPickerThumbPosition();
  commitThemeColor(currentPickerHex());
});
svSquare.addEventListener('pointermove', (e) => {
  if (!svDragging) return;
  svPointerToValues(e.clientX, e.clientY);
  setPickerThumbPosition();
  commitThemeColor(currentPickerHex());
});
svSquare.addEventListener('pointerup', () => { svDragging = false; });

hueSlider.addEventListener('input', () => {
  pickerHue = Number(hueSlider.value);
  updateSvBackground();
  commitThemeColor(currentPickerHex());
});

themeHexInput.addEventListener('change', () => {
  let hex = themeHexInput.value.trim();
  if (!hex.startsWith('#')) hex = '#' + hex;
  if (!hexToRgb(hex)) { themeHexInput.value = currentPickerHex(); return; }
  setPickerFromHex(hex);
  commitThemeColor(hex);
});

function addColorCard(tab, hex) {
  hideEmptyState(tab);
  const row = document.createElement('div');
  row.className = 'row assistant';
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.style.color = 'var(--accent)';
  avatar.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M20.71 5.63l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-3.12 3.12-1.93-1.91-1.41 1.41 1.42 1.42L3 16.25V21h4.75l8.92-8.92 1.42 1.42 1.41-1.41-1.92-1.92 3.12-3.12c.4-.4.4-1.03.01-1.42zM6.92 19H5v-1.92l9.06-9.06 1.92 1.92L6.92 19z"/></svg>';
  const card = document.createElement('div');
  card.className = 'color-card';
  const swatch = document.createElement('div');
  swatch.className = 'swatch';
  swatch.style.background = hex;
  const info = document.createElement('div');
  info.className = 'info';
  const hexEl = document.createElement('div');
  hexEl.className = 'hex';
  hexEl.textContent = hex.toUpperCase();
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = 'cor capturada com o conta-gotas';
  info.appendChild(hexEl);
  info.appendChild(label);
  const wheelBtn = document.createElement('button');
  wheelBtn.className = 'wheel-btn';
  wheelBtn.title = 'Ver no círculo cromático e cores que combinam';
  wheelBtn.textContent = '🎨';
  wheelBtn.addEventListener('click', () => openColorWheel(hex));
  card.appendChild(swatch);
  card.appendChild(info);
  card.appendChild(wheelBtn);
  row.appendChild(avatar);
  row.appendChild(card);
  tab.messagesEl.appendChild(row);
  scrollTabToBottom(tab);
}

eyedropperBtn.addEventListener('click', () => window.atelie.openEyedropper());

window.atelie.onEyedropperResult(async (hex) => {
  const tab = activeTab();
  if (!tab) return;
  const upperHex = hex.toUpperCase();
  addColorCard(tab, upperHex);
  const res = await window.atelie.saveColor(tab.localId, upperHex);
  tab.localId = res.localId || tab.localId;
  if (tab.title === 'Nova conversa') {
    tab.title = `Cor ${upperHex}`;
    renderTabBar();
  }
});

window.atelie.onEyedropperError((message) => {
  const tab = activeTab();
  if (!tab) return;
  addAssistantRow(tab, message, true);
});

function placeWheelDot(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const [h, s] = rgbToHsv(...rgb);
  const radius = s * 50;
  const angle = (h - 90) * (Math.PI / 180);
  const x = 50 + radius * Math.cos(angle);
  const y = 50 + radius * Math.sin(angle);
  colorwheelDot.style.left = x + '%';
  colorwheelDot.style.top = y + '%';
}

function readableTextColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000000';
  const [r, g, b] = rgb.map((v) => v / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.55 ? '#1E2A44' : '#FFFFFF';
}

function buildHarmonyPage(hex, comp, an1, an2, tri1, tri2) {
  const row = (hexList) => hexList.map((c) => `
    <button class="harmony-swatch" data-hex="${c}" title="Clique para ver esta cor no círculo cromático">
      <div class="chip" style="background:${c}; color:${hex};">Aa</div>
      <div class="chip-hex">${c}</div>
    </button>`).join('');

  return {
    html: `
      <div class="harmony-group">
        <label>Complementar</label>
        <div class="harmony-row">${row([comp])}</div>
      </div>
      <div class="harmony-group">
        <label>Análogas (suave)</label>
        <div class="harmony-row">${row([an1, an2])}</div>
      </div>
      <div class="harmony-group">
        <label>Triádica (vibrante)</label>
        <div class="harmony-row">${row([tri1, tri2])}</div>
      </div>`,
  };
}

function buildUsagePages(hex, comp, an1, an2, tri1, tri2) {
  const onHex = readableTextColor(hex);
  const onComp = readableTextColor(comp);
  const onAn1 = readableTextColor(an1);
  const onTri1 = readableTextColor(tri1);
  const onTri2 = readableTextColor(tri2);

  return [
    {
      html: `<div class="usage-mock-frame"><div class="usage-mock" style="background:${hex}; color:${onHex};">
        <div class="usage-mock-heading">Título em destaque</div>
        <div class="usage-mock-text">Um parágrafo de exemplo pra ver como o texto fica legível em cima dessa cor.</div>
      </div></div>`,
    },
    {
      html: `<div class="usage-mock-frame"><div class="usage-mock usage-mock-light">
        <div class="usage-mock-heading" style="color:${hex};">Título em destaque</div>
        <div class="usage-mock-text" style="color:${hex};">Texto corrido usando a cor escolhida — bom pra títulos, links ou detalhes.</div>
      </div></div>`,
    },
    {
      html: `<div class="usage-mock-frame"><div class="usage-mock usage-mock-light">
        <div class="usage-mock-text" style="color:var(--ink-soft);">Peça pra ver o botão:</div>
        <button class="usage-mock-btn" style="background:${hex}; color:${onHex};">Clique aqui</button>
      </div></div>`,
    },
    {
      html: `<div class="usage-mock-frame"><div class="usage-mock usage-mock-split">
        <div style="background:${hex}; color:${comp};">Aa</div>
        <div style="background:${comp}; color:${hex};">Aa</div>
      </div></div>`,
    },
    {
      html: `<div class="usage-mock-frame"><div class="usage-mock usage-mock-strip">
        <div style="background:${an1};"></div>
        <div style="background:${hex};"></div>
        <div style="background:${an2};"></div>
      </div></div>`,
    },
    {
      html: `<div class="usage-mock-frame"><div class="usage-mock" style="background:${hex}; color:${onHex};">
        <div class="usage-mock-heading">Cartão de destaque</div>
        <div class="usage-mock-text">A cor escolhida como fundo, com um botão na complementar por cima — pra criar contraste.</div>
        <button class="usage-mock-btn" style="background:${comp}; color:${onComp};">Saiba mais</button>
      </div></div>`,
    },
    {
      html: `<div class="usage-mock-frame"><div class="usage-mock usage-mock-light">
        <div class="usage-mock-heading" style="color:${hex};">Categoria</div>
        <div class="usage-mock-text">Título na cor escolhida, uma tag no tom vizinho e um risco de destaque no outro.</div>
        <div class="usage-mock-row">
          <span class="usage-mock-tag" style="background:${an1}; color:${onAn1};">Tag</span>
          <span class="usage-mock-rule" style="background:${an2};"></span>
        </div>
      </div></div>`,
    },
    {
      html: `<div class="usage-mock-frame"><div class="usage-mock usage-mock-light">
        <div class="usage-mock-text" style="color:var(--ink-soft);">Três cores bem espaçadas, cada uma com seu papel:</div>
        <div class="usage-mock-row">
          <button class="usage-mock-btn" style="background:${hex}; color:${onHex};">Principal</button>
          <button class="usage-mock-btn" style="background:${tri1}; color:${onTri1};">Ação</button>
          <button class="usage-mock-btn" style="background:${tri2}; color:${onTri2};">Aviso</button>
        </div>
      </div></div>`,
    },
  ];
}

let usagePages = [];
let usagePageIndex = 0;
const usagePrevBtn = document.getElementById('usage-prev');
const usageNextBtn = document.getElementById('usage-next');
const usagePreviewEl = document.getElementById('usage-preview');
const usageDotsEl = document.getElementById('usage-dots');

function renderUsagePage() {
  const page = usagePages[usagePageIndex];
  if (!page) return;
  usagePreviewEl.innerHTML = page.html;
  usageDotsEl.innerHTML = '';
  usagePages.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'usage-dot' + (i === usagePageIndex ? ' active' : '');
    usageDotsEl.appendChild(dot);
  });
}

usagePrevBtn.addEventListener('click', () => {
  usagePageIndex = (usagePageIndex - 1 + usagePages.length) % usagePages.length;
  renderUsagePage();
});
usageNextBtn.addEventListener('click', () => {
  usagePageIndex = (usagePageIndex + 1) % usagePages.length;
  renderUsagePage();
});
usagePreviewEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.harmony-swatch');
  if (btn && btn.dataset.hex) openColorWheel(btn.dataset.hex);
});

function openColorWheel(hex) {
  hex = hex.toUpperCase();
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const [h, s, v] = rgbToHsv(...rgb);
  const at = (deltaH) => rgbToHex(...hsvToRgb(((h + deltaH) % 360 + 360) % 360, s, v));
  const comp = at(180);
  const an1 = at(-30);
  const an2 = at(30);
  const tri1 = at(120);
  const tri2 = at(240);

  colorwheelSwatch.style.background = hex;
  colorwheelSwatch.style.color = readableTextColor(hex);
  colorwheelSwatch.textContent = 'Aa';
  colorwheelHex.textContent = hex;
  placeWheelDot(hex);

  usagePages = [buildHarmonyPage(hex, comp, an1, an2, tri1, tri2), ...buildUsagePages(hex, comp, an1, an2, tri1, tri2)];
  usagePageIndex = 0;
  renderUsagePage();

  colorwheelOverlay.classList.add('show');
}

colorwheelClose.addEventListener('click', () => colorwheelOverlay.classList.remove('show'));

function openQuestionsModal(tab, questions) {
  currentQuestions = { tab, questions };
  questionsFields.innerHTML = '';
  questions.forEach((q) => {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const label = document.createElement('label');
    label.textContent = q.question;
    const ta = document.createElement('textarea');
    ta.rows = 2;
    if (q.placeholder) ta.placeholder = q.placeholder;
    wrap.appendChild(label);
    wrap.appendChild(ta);
    questionsFields.appendChild(wrap);
  });
  questionsOverlay.classList.add('show');
}

questionsCancelBtn.addEventListener('click', () => {
  questionsOverlay.classList.remove('show');
  currentQuestions = null;
});

questionsSendBtn.addEventListener('click', async () => {
  if (!currentQuestions) return;
  const { tab, questions } = currentQuestions;
  const textareas = questionsFields.querySelectorAll('textarea');
  const parts = questions.map((q, i) => {
    const answer = (textareas[i] && textareas[i].value.trim()) || '(não respondido)';
    return `${q.question}\nResposta: ${answer}`;
  });
  questionsOverlay.classList.remove('show');
  currentQuestions = null;
  await doSend(tab, parts.join('\n\n'), null);
});

let editingTab = null;
const selectionCanvas = document.getElementById('selection-canvas');
const selCtx = selectionCanvas.getContext('2d', { willReadFrequently: true });
const toleranceRow = document.getElementById('tolerance-row');
const brushSizeRow = document.getElementById('brush-size-row');
const brushSizeSlider = document.getElementById('brush-size-slider');
const wandContiguousCheckbox = document.getElementById('wand-contiguous');
const brushCursor = document.getElementById('brush-cursor');
const SELECTION_FILL = 'rgba(60, 130, 255, 0.5)';
const SELECTION_ALPHA_THRESHOLD = 10;

let activeTool = 'wand';
let lassoPoints = [];
let lassoSubtract = false;
let committedSelectionData = null;
let brushing = false;
let brushSubtract = false;

const toolButtons = {
  wand: document.getElementById('tool-wand'),
  lasso: document.getElementById('tool-lasso'),
  brush: document.getElementById('tool-brush'),
};

function setActiveTool(tool) {
  activeTool = tool;
  Object.entries(toolButtons).forEach(([name, btn]) => btn.classList.toggle('active', name === tool));
  toleranceRow.style.display = tool === 'wand' ? 'flex' : 'none';
  brushSizeRow.style.display = tool === 'brush' ? 'flex' : 'none';
  selectionCanvas.classList.toggle('brush-active', tool === 'brush');
  brushCursor.style.display = 'none';
  lassoPoints = [];
  redrawSelectionWithLassoPreview();
}
Object.entries(toolButtons).forEach(([name, btn]) => btn.addEventListener('click', () => setActiveTool(name)));

function openImageEditor(dataUrl) {
  editingTab = activeTab();
  const img = new Image();
  img.onload = () => {
    editCanvas.width = img.naturalWidth;
    editCanvas.height = img.naturalHeight;
    selectionCanvas.width = img.naturalWidth;
    selectionCanvas.height = img.naturalHeight;
    editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
    editCtx.drawImage(img, 0, 0);
    selCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    committedSelectionData = selCtx.getImageData(0, 0, selectionCanvas.width, selectionCanvas.height);
    undoStack = [];
    lassoPoints = [];
    setActiveTool('wand');
    imageEditorOverlay.classList.add('show');
  };
  img.src = dataUrl;
}

function pushUndoSnapshot() {
  undoStack.push({
    image: editCtx.getImageData(0, 0, editCanvas.width, editCanvas.height),
    selection: selCtx.getImageData(0, 0, selectionCanvas.width, selectionCanvas.height),
  });
  if (undoStack.length > 8) undoStack.shift();
}

function undoEdit() {
  const prev = undoStack.pop();
  if (!prev) return;
  editCtx.putImageData(prev.image, 0, 0);
  selCtx.putImageData(prev.selection, 0, 0);
  committedSelectionData = prev.selection;
  lassoPoints = [];
}

function canvasPointFromEvent(e) {
  const rect = selectionCanvas.getBoundingClientRect();
  const scaleX = selectionCanvas.width / rect.width;
  const scaleY = selectionCanvas.height / rect.height;
  return {
    x: Math.floor((e.clientX - rect.left) * scaleX),
    y: Math.floor((e.clientY - rect.top) * scaleY),
  };
}

function commitSelection() {
  committedSelectionData = selCtx.getImageData(0, 0, selectionCanvas.width, selectionCanvas.height);
}

function wandSelect(startX, startY, tolerance, subtract, contiguous) {
  const w = editCanvas.width, h = editCanvas.height;
  const base = editCtx.getImageData(0, 0, w, h).data;
  const startIdx = (startY * w + startX) * 4;
  if (base[startIdx + 3] === 0) return;
  const r0 = base[startIdx], g0 = base[startIdx + 1], b0 = base[startIdx + 2];
  const tol2 = tolerance * tolerance * 3;
  const sel = selCtx.getImageData(0, 0, w, h);
  const sd = sel.data;

  const applyPixel = (i) => {
    if (subtract) {
      sd[i + 3] = 0;
    } else {
      sd[i] = 60; sd[i + 1] = 130; sd[i + 2] = 255; sd[i + 3] = 130;
    }
  };

  if (contiguous) {
    const visited = new Uint8Array(w * h);
    const stack = [[startX, startY]];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const vIdx = y * w + x;
      if (visited[vIdx]) continue;
      visited[vIdx] = 1;
      const i = vIdx * 4;
      if (base[i + 3] === 0) continue;
      const dr = base[i] - r0, dg = base[i + 1] - g0, db = base[i + 2] - b0;
      if (dr * dr + dg * dg + db * db > tol2) continue;
      applyPixel(i);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  } else {
    for (let i = 0; i < base.length; i += 4) {
      if (base[i + 3] === 0) continue;
      const dr = base[i] - r0, dg = base[i + 1] - g0, db = base[i + 2] - b0;
      if (dr * dr + dg * dg + db * db > tol2) continue;
      applyPixel(i);
    }
  }
  selCtx.putImageData(sel, 0, 0);
}

function redrawSelectionWithLassoPreview() {
  if (committedSelectionData) selCtx.putImageData(committedSelectionData, 0, 0);
  if (lassoPoints.length === 0) return;
  const previewColor = lassoSubtract ? 'rgba(220, 60, 60, 0.9)' : 'rgba(30, 90, 220, 0.9)';
  selCtx.strokeStyle = previewColor;
  selCtx.fillStyle = previewColor;
  selCtx.lineWidth = Math.max(1, editCanvas.width / 400);
  selCtx.beginPath();
  selCtx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
  for (let i = 1; i < lassoPoints.length; i++) selCtx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
  selCtx.stroke();
  const dotR = Math.max(2, editCanvas.width / 250);
  lassoPoints.forEach((p) => {
    selCtx.beginPath();
    selCtx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
    selCtx.fill();
  });
}

function closeLasso() {
  if (lassoPoints.length < 3) {
    lassoPoints = [];
    redrawSelectionWithLassoPreview();
    return;
  }
  pushUndoSnapshot();
  if (committedSelectionData) selCtx.putImageData(committedSelectionData, 0, 0);
  selCtx.globalCompositeOperation = lassoSubtract ? 'destination-out' : 'source-over';
  selCtx.fillStyle = lassoSubtract ? 'rgba(0, 0, 0, 1)' : SELECTION_FILL;
  selCtx.beginPath();
  selCtx.moveTo(lassoPoints[0].x, lassoPoints[0].y);
  for (let i = 1; i < lassoPoints.length; i++) selCtx.lineTo(lassoPoints[i].x, lassoPoints[i].y);
  selCtx.closePath();
  selCtx.fill();
  selCtx.globalCompositeOperation = 'source-over';
  lassoPoints = [];
  commitSelection();
}

function paintBrush(e, subtract) {
  const { x, y } = canvasPointFromEvent(e);
  selCtx.globalCompositeOperation = subtract ? 'destination-out' : 'source-over';
  selCtx.fillStyle = subtract ? 'rgba(0, 0, 0, 1)' : SELECTION_FILL;
  selCtx.beginPath();
  selCtx.arc(x, y, Number(brushSizeSlider.value), 0, Math.PI * 2);
  selCtx.fill();
  selCtx.globalCompositeOperation = 'source-over';
}

selectionCanvas.addEventListener('click', (e) => {
  if (activeTool === 'brush') return;
  const { x, y } = canvasPointFromEvent(e);
  if (x < 0 || y < 0 || x >= selectionCanvas.width || y >= selectionCanvas.height) return;

  if (activeTool === 'wand') {
    pushUndoSnapshot();
    wandSelect(x, y, Number(toleranceSlider.value), e.altKey, wandContiguousCheckbox.checked);
    commitSelection();
  } else if (activeTool === 'lasso') {
    if (lassoPoints.length === 0) lassoSubtract = e.altKey;
    lassoPoints.push({ x, y });
    redrawSelectionWithLassoPreview();
  }
});

selectionCanvas.addEventListener('dblclick', () => {
  if (activeTool === 'lasso') closeLasso();
});

function updateBrushCursor(e) {
  if (activeTool !== 'brush') {
    brushCursor.style.display = 'none';
    return;
  }
  const rect = selectionCanvas.getBoundingClientRect();
  const stackRect = selectionCanvas.parentElement.getBoundingClientRect();
  const scale = rect.width / selectionCanvas.width;
  const size = Number(brushSizeSlider.value) * 2 * scale;
  brushCursor.style.width = size + 'px';
  brushCursor.style.height = size + 'px';
  brushCursor.style.left = (e.clientX - stackRect.left) + 'px';
  brushCursor.style.top = (e.clientY - stackRect.top) + 'px';
  brushCursor.classList.toggle('subtract', e.altKey);
  brushCursor.style.display = 'block';
}

selectionCanvas.addEventListener('pointerdown', (e) => {
  if (activeTool !== 'brush') return;
  brushing = true;
  brushSubtract = e.altKey;
  pushUndoSnapshot();
  selectionCanvas.setPointerCapture(e.pointerId);
  paintBrush(e, brushSubtract);
});
selectionCanvas.addEventListener('pointermove', (e) => {
  updateBrushCursor(e);
  if (!brushing) return;
  paintBrush(e, brushSubtract);
});
selectionCanvas.addEventListener('pointerup', () => {
  if (!brushing) return;
  brushing = false;
  commitSelection();
});
selectionCanvas.addEventListener('pointerleave', () => {
  brushCursor.style.display = 'none';
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Alt' && imageEditorOverlay.classList.contains('show')) brushCursor.classList.add('subtract');
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'Alt') brushCursor.classList.remove('subtract');
});

document.getElementById('tool-invert').addEventListener('click', () => {
  pushUndoSnapshot();
  const w = selectionCanvas.width, h = selectionCanvas.height;
  const sel = selCtx.getImageData(0, 0, w, h);
  const sd = sel.data;
  for (let i = 0; i < sd.length; i += 4) {
    if (sd[i + 3] > SELECTION_ALPHA_THRESHOLD) {
      sd[i + 3] = 0;
    } else {
      sd[i] = 60; sd[i + 1] = 130; sd[i + 2] = 255; sd[i + 3] = 130;
    }
  }
  selCtx.putImageData(sel, 0, 0);
  committedSelectionData = sel;
  lassoPoints = [];
});

document.getElementById('tool-clear-selection').addEventListener('click', () => {
  pushUndoSnapshot();
  selCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
  commitSelection();
  lassoPoints = [];
});

document.getElementById('editor-delete-selected').addEventListener('click', () => {
  const w = editCanvas.width, h = editCanvas.height;
  const sel = selCtx.getImageData(0, 0, w, h).data;
  let any = false;
  for (let i = 3; i < sel.length; i += 4) {
    if (sel[i] > SELECTION_ALPHA_THRESHOLD) { any = true; break; }
  }
  if (!any) return;

  pushUndoSnapshot();
  const img = editCtx.getImageData(0, 0, w, h);
  const id = img.data;
  for (let i = 0; i < id.length; i += 4) {
    if (sel[i + 3] > SELECTION_ALPHA_THRESHOLD) id[i + 3] = 0;
  }
  editCtx.putImageData(img, 0, 0);
  selCtx.clearRect(0, 0, w, h);
  commitSelection();
});

document.getElementById('editor-undo').addEventListener('click', undoEdit);

document.addEventListener('keydown', (e) => {
  if (!imageEditorOverlay.classList.contains('show')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undoEdit();
  }
});

document.getElementById('editor-cancel').addEventListener('click', () => {
  imageEditorOverlay.classList.remove('show');
});

document.getElementById('editor-apply').addEventListener('click', async () => {
  const dataUrl = editCanvas.toDataURL('image/png');
  imageEditorOverlay.classList.remove('show');
  const tab = editingTab || activeTab();
  if (!tab) return;
  attachmentChip.classList.add('show');
  attachmentStatus.textContent = 'salvando edição...';
  const res = await window.atelie.removeBackgroundManual(dataUrl);
  if (res.ok) {
    setPendingImage(tab, { name: res.name, previewUrl: res.previewUrl }, '🖌️ fundo removido (manual) ✓');
  } else {
    attachmentStatus.textContent = res.error || 'não consegui salvar';
  }
});

const shellEl = document.getElementById('shell');

const FLYOUT_ANCHOR_ORIGIN = {
  'bottom-right': '100% 100%',
  'bottom-left': '0% 100%',
  'top-right': '100% 0%',
  'top-left': '0% 0%',
};

window.atelie.onFlyoutOpen((anchor) => {
  shellEl.style.transformOrigin = FLYOUT_ANCHOR_ORIGIN[anchor] || '50% 100%';
  shellEl.classList.add('flyout-collapsed');
  void shellEl.offsetHeight;
  requestAnimationFrame(() => shellEl.classList.remove('flyout-collapsed'));
});

window.atelie.onFlyoutClose(() => {
  shellEl.classList.add('flyout-collapsed');
  const done = () => {
    shellEl.removeEventListener('transitionend', done);
    window.atelie.notifyFlyoutCloseDone();
  };
  shellEl.addEventListener('transitionend', done);
  setTimeout(done, 300);
});

(async function init() {
  const s = await window.atelie.getSettings();
  applySettingsToUI(s);

  const sessions = await window.atelie.listSessions();
  const first = createTab();
  switchToTab(first.id);
  if (sessions.length > 0) {
    await refreshHome();
    showScreen('home-screen');
  } else {
    showScreen('chat-screen');
    textInput.focus();
  }
})();
