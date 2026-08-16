require('dotenv').config();

const { app, BrowserWindow, ipcMain, dialog, desktopCapturer, screen, globalShortcut, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const sharp = require('sharp');

const CLAUDE_CLI_COMMAND = process.env.CLAUDE_CLI_COMMAND || 'claude';

const userDataDir = app.getPath('userData');
const workdir = path.join(userDataDir, 'workdir');
const uploadsDir = path.join(workdir, 'uploads');
const claudeMdPath = path.join(workdir, 'CLAUDE.md');
const personaTemplatePath = path.join(__dirname, 'assets', 'claude-persona.md');
const settingsPath = path.join(userDataDir, 'settings.json');
const sessionsIndexPath = path.join(userDataDir, 'sessions.json');
const transcriptsDir = path.join(userDataDir, 'transcripts');
const colorHistoryPath = path.join(userDataDir, 'colorHistory.json');

const MAX_IMAGE_DIMENSION = 1568;

function ensureWorkdir() {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(transcriptsDir, { recursive: true });
  const persona = fs.readFileSync(personaTemplatePath, 'utf-8');
  fs.writeFileSync(claudeMdPath, persona, 'utf-8');
}

const DEFAULT_SETTINGS = {
  hotkey: 'CommandOrControl+Shift+D',
  eyedropperHotkey: 'CommandOrControl+Shift+E',
  model: null,
  showFloatingWidget: true,
  floatingPos: null,
  themeColor: '#2F6FED',
};

function loadSettings() {
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(partial) {
  const merged = { ...loadSettings(), ...partial };
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}

let settings = DEFAULT_SETTINGS;

function loadSessionsIndex() {
  try {
    return JSON.parse(fs.readFileSync(sessionsIndexPath, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function saveSessionsIndex(list) {
  fs.writeFileSync(sessionsIndexPath, JSON.stringify(list, null, 2), 'utf-8');
}

function listSessionsSorted() {
  return loadSessionsIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

function transcriptPath(localId) {
  return path.join(transcriptsDir, `${localId}.json`);
}

function loadTranscript(localId) {
  try {
    return JSON.parse(fs.readFileSync(transcriptPath(localId), 'utf-8'));
  } catch (e) {
    return [];
  }
}

function appendToTranscript(localId, message) {
  const t = loadTranscript(localId);
  t.push(message);
  fs.writeFileSync(transcriptPath(localId), JSON.stringify(t, null, 2), 'utf-8');
}

function deleteSession(localId) {
  saveSessionsIndex(loadSessionsIndex().filter((s) => s.localId !== localId));
  try { fs.unlinkSync(transcriptPath(localId)); } catch (e) {}
}

function loadColorHistory() {
  try {
    return JSON.parse(fs.readFileSync(colorHistoryPath, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function addColorToHistory(hex) {
  const list = loadColorHistory();
  list.unshift({ hex, ts: Date.now() });
  if (list.length > 200) list.length = 200;
  fs.writeFileSync(colorHistoryPath, JSON.stringify(list, null, 2), 'utf-8');
  return list;
}

function upsertSessionMeta(localId, updates) {
  const list = loadSessionsIndex();
  const idx = list.findIndex((s) => s.localId === localId);
  const now = Date.now();
  if (idx === -1) {
    list.push({ localId, claudeSessionId: null, title: 'Nova conversa', createdAt: now, updatedAt: now, ...updates });
  } else {
    list[idx] = { ...list[idx], ...updates, updatedAt: now };
  }
  saveSessionsIndex(list);
}

let mainWindow = null;
let widgetWindow = null;
let tray = null;
let isQuitting = false;
let preEditorBounds = null;

function enterEditorFullscreen() {
  if (!mainWindow || mainWindow.isDestroyed() || preEditorBounds) return;
  preEditorBounds = mainWindow.getBounds();
  const display = screen.getDisplayMatching(preEditorBounds);
  mainWindow.setBounds(display.workArea);
}

function exitEditorFullscreen() {
  if (!mainWindow || mainWindow.isDestroyed() || !preEditorBounds) return;
  mainWindow.setBounds(preEditorBounds);
  preEditorBounds = null;
}

function makeTitle(text) {
  const clean = (text || '').trim().replace(/\s+/g, ' ');
  if (!clean) return 'Imagem';
  return clean.length > 46 ? clean.slice(0, 46) + '…' : clean;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 760,
    minWidth: 380,
    minHeight: 520,
    title: 'Ateliê Azul',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    transparent: true,
    hasShadow: false,
    autoHideMenuBar: true,
    skipTaskbar: false,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      exitEditorFullscreen();
      mainWindow.hide();
    }
  });
}

function computeFlyoutPlacement(win, originBounds) {
  const { width, height } = win.getBounds();
  const display = screen.getDisplayNearestPoint({ x: originBounds.x, y: originBounds.y });
  const area = display.workArea;
  const margin = 12;
  const closeGap = 25;

  const screenCenterX = area.x + area.width / 2;
  const btnCenterX = originBounds.x + originBounds.width / 2;

  let x, anchorX;
  if (btnCenterX >= screenCenterX) {
    x = originBounds.x + originBounds.width - width;
    anchorX = 'right';
  } else {
    x = originBounds.x;
    anchorX = 'left';
  }
  x = Math.max(area.x + margin, Math.min(x, area.x + area.width - width - margin));

  const spaceAbove = originBounds.y - area.y;
  let y, anchorY;
  if (spaceAbove >= height + margin) {
    y = originBounds.y - height - margin + closeGap;
    anchorY = 'bottom';
  } else {
    y = originBounds.y + originBounds.height + margin - closeGap;
    anchorY = 'top';
  }
  y = Math.max(area.y + margin, Math.min(y, area.y + area.height - height - margin));

  return { rect: { x, y, width, height }, anchor: `${anchorY}-${anchorX}` };
}

function showMainWindow(originBounds) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!widgetWindow || widgetWindow.isDestroyed()) createWidgetWindow();

  if (!mainWindow.isVisible()) {
    let anchor = null;
    if (originBounds) {
      const placement = computeFlyoutPlacement(mainWindow, originBounds);
      mainWindow.setBounds(placement.rect);
      anchor = placement.anchor;
    }
    mainWindow.show();
    mainWindow.webContents.send('flyout:open', anchor);
    mainWindow.focus();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function hideMainWindowAnimated() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  };
  ipcMain.once('flyout:closeDone', finish);
  mainWindow.webContents.send('flyout:close');
  setTimeout(finish, 400);
}

function toggleMainWindowFrom(originBounds) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    hideMainWindowAnimated();
    return;
  }
  showMainWindow(originBounds);
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'icon.ico'));
  tray.setToolTip('Ateliê Azul');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Ateliê Azul', click: () => showMainWindow(tray.getBounds()) },
    { type: 'separator' },
    { label: 'Sair', click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on('click', () => toggleMainWindowFrom(tray.getBounds()));
}

function createWidgetWindow() {
  const pos = settings.floatingPos;
  widgetWindow = new BrowserWindow({
    width: 64,
    height: 64,
    x: pos ? pos.x : undefined,
    y: pos ? pos.y : undefined,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'widget-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  widgetWindow.setAlwaysOnTop(true, 'screen-saver');
  widgetWindow.loadFile(path.join(__dirname, 'renderer', 'widget.html'));

  if (!pos) {
    const { width } = screen.getPrimaryDisplay().workAreaSize;
    widgetWindow.setPosition(width - 100, 140);
  }

  let saveTimer = null;
  widgetWindow.on('moved', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (widgetWindow && !widgetWindow.isDestroyed()) {
        const [x, y] = widgetWindow.getPosition();
        settings = saveSettings({ floatingPos: { x, y } });
      }
    }, 400);
  });
}

const registeredAccelerators = {};

function registerNamedShortcut(purpose, accelerator, callback) {
  const previous = registeredAccelerators[purpose];
  if (previous) {
    globalShortcut.unregister(previous);
    delete registeredAccelerators[purpose];
  }
  if (!accelerator) return true;
  try {
    globalShortcut.register(accelerator, callback);
    if (globalShortcut.isRegistered(accelerator)) {
      registeredAccelerators[purpose] = accelerator;
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

async function onScreenshotHotkey() {
  const result = await captureScreenNow();
  showMainWindow();
  if (result && mainWindow) {
    mainWindow.webContents.send('capture:fromHotkey', result);
  }
}

let eyedropperWindow = null;

async function openEyedropper() {
  if (eyedropperWindow && !eyedropperWindow.isDestroyed()) return;

  const point = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(point);
  const { x, y, width, height } = display.bounds;
  const scale = display.scaleFactor;

  let source;
  try {
    const sources = await Promise.race([
      desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: Math.round(width * scale), height: Math.round(height * scale) },
      }),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]);
    source = sources.find((s) => s.display_id === String(display.id)) || sources[0];
  } catch (e) {
    if (mainWindow) {
      mainWindow.webContents.send(
        'eyedropper:error',
        'Não consegui capturar a tela pro conta-gotas (algum programa, tipo jogo com anti-cheat, pode estar bloqueando a captura de tela agora).'
      );
    }
    return;
  }
  if (!source || source.thumbnail.isEmpty()) {
    if (mainWindow) mainWindow.webContents.send('eyedropper:error', 'Não consegui capturar a tela pro conta-gotas.');
    return;
  }

  const dataUrl = source.thumbnail.toDataURL();
  const imgSize = source.thumbnail.getSize();

  eyedropperWindow = new BrowserWindow({
    x, y, width, height,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'eyedropper-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  eyedropperWindow.setAlwaysOnTop(true, 'screen-saver');
  eyedropperWindow.loadFile(path.join(__dirname, 'renderer', 'eyedropper-overlay.html'));
  eyedropperWindow.once('ready-to-show', () => {
    if (!eyedropperWindow || eyedropperWindow.isDestroyed()) return;
    eyedropperWindow.webContents.send('eyedropper:image', dataUrl, imgSize.width, imgSize.height);
    eyedropperWindow.show();
    eyedropperWindow.focus();
  });
  eyedropperWindow.on('closed', () => { eyedropperWindow = null; });
}

function closeEyedropper() {
  if (eyedropperWindow && !eyedropperWindow.isDestroyed()) eyedropperWindow.close();
  eyedropperWindow = null;
}

async function saveBufferAsUpload(buffer, ext, prefix) {
  const destName = `${prefix}-${Date.now()}${ext}`;
  const dest = path.join(uploadsDir, destName);
  await sharp(buffer)
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toFile(dest);
  return { name: destName, previewUrl: pathToFileURL(dest).href };
}

async function captureScreenNow() {
  if (!mainWindow) return null;
  const wasVisible = mainWindow.isVisible();
  mainWindow.minimize();
  await new Promise((r) => setTimeout(r, 450));

  try {
    const display = screen.getPrimaryDisplay();
    const width = Math.round(display.size.width * display.scaleFactor);
    const height = Math.round(display.size.height * display.scaleFactor);

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height },
    });
    const source = sources[0];
    if (!source || source.thumbnail.isEmpty()) return null;

    const png = source.thumbnail.toPNG();
    return await saveBufferAsUpload(png, '.png', 'print');
  } catch (e) {
    return null;
  } finally {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.restore();
      if (wasVisible) mainWindow.focus();
    }
  }
}

function runClaude(promptText, claudeSessionId) {
  return new Promise((resolve) => {
    const args = [
      '-p',
      '--tools', 'Read',
      '--permission-mode', 'bypassPermissions',
      '--output-format', 'json',
      '--effort', 'low',
    ];
    if (settings.model) args.push('--model', settings.model);
    if (claudeSessionId) args.push('--resume', claudeSessionId);

    const child = spawn(CLAUDE_CLI_COMMAND, args, {
      cwd: workdir,
      shell: true,
      windowsHide: true,
    });

    let out = '';
    let sawError = false;

    child.stdout.on('data', (d) => { out += d.toString('utf-8'); });
    child.stderr.on('data', () => { sawError = true; });

    child.on('error', () => {
      resolve({ ok: false, text: 'Não consegui abrir o Claude Code. Confirma se ele está instalado e logado.', sessionId: claudeSessionId });
    });

    child.on('close', () => {
      const lastLine = out.trim().split('\n').filter(Boolean).pop();
      try {
        const parsed = JSON.parse(lastLine);
        const sessionId = parsed.session_id || claudeSessionId;
        if (parsed.is_error) {
          resolve({ ok: false, text: parsed.result || 'Algo deu errado. Pode tentar de novo?', sessionId });
        } else {
          resolve({ ok: true, text: parsed.result || '(sem resposta)', sessionId });
        }
      } catch (e) {
        resolve({
          ok: false,
          text: sawError
            ? 'Não consegui falar com o Claude Code agora. Confirma se está logado (abra um terminal e rode "claude").'
            : 'Não consegui entender a resposta. Pode tentar de novo?',
          sessionId: claudeSessionId,
        });
      }
    });

    child.stdin.write(promptText, 'utf-8');
    child.stdin.end();
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showMainWindow();
  });

  app.whenReady().then(() => {
    ensureWorkdir();
    settings = loadSettings();
    createMainWindow();
    if (settings.showFloatingWidget) createWidgetWindow();
    createTray();
    if (!registerNamedShortcut('screenshot', settings.hotkey, onScreenshotHotkey)) {
      settings = saveSettings({ hotkey: DEFAULT_SETTINGS.hotkey });
      registerNamedShortcut('screenshot', settings.hotkey, onScreenshotHotkey);
    }
    if (!registerNamedShortcut('eyedropper', settings.eyedropperHotkey, () => openEyedropper())) {
      settings = saveSettings({ eyedropperHotkey: DEFAULT_SETTINGS.eyedropperHotkey });
      registerNamedShortcut('eyedropper', settings.eyedropperHotkey, () => openEyedropper());
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    if (tray && !tray.isDestroyed()) tray.destroy();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

ipcMain.handle('chat:send', async (_event, { localId, text, imageName }) => {
  let promptText = (text || '').trim();
  if (imageName) {
    promptText = `[Imagem anexada em: uploads/${imageName}]\n${promptText}`;
  }
  if (!promptText) return { ok: false, text: 'Escreva alguma coisa antes de enviar :)', localId };

  let id = localId;
  let claudeSessionId = null;
  if (!id) {
    id = crypto.randomUUID();
    upsertSessionMeta(id, { title: makeTitle(text) });
  } else {
    const entry = loadSessionsIndex().find((s) => s.localId === id);
    claudeSessionId = entry ? entry.claudeSessionId : null;
  }

  const userImagePreviewUrl = imageName
    ? pathToFileURL(path.join(uploadsDir, imageName)).href
    : null;
  appendToTranscript(id, { role: 'user', text: text || '', imagePreviewUrl: userImagePreviewUrl, ts: Date.now() });

  const res = await runClaude(promptText, claudeSessionId);

  appendToTranscript(id, { role: 'assistant', text: res.text, error: !res.ok, ts: Date.now() });
  upsertSessionMeta(id, { claudeSessionId: res.sessionId || claudeSessionId });

  return { ok: res.ok, text: res.text, localId: id };
});

ipcMain.handle('chat:saveColor', async (_event, { localId, hex }) => {
  let id = localId;
  if (!id) {
    id = crypto.randomUUID();
    upsertSessionMeta(id, { title: `Cor ${hex}` });
  } else {
    upsertSessionMeta(id, {});
  }
  appendToTranscript(id, { role: 'user', kind: 'color', hex, ts: Date.now() });
  return { localId: id };
});

ipcMain.handle('sessions:list', async () => {
  return listSessionsSorted().map((s) => ({ localId: s.localId, title: s.title, updatedAt: s.updatedAt }));
});

ipcMain.handle('sessions:open', async (_event, { localId }) => {
  const list = loadSessionsIndex();
  const entry = list.find((s) => s.localId === localId);
  if (!entry) return null;
  return loadTranscript(localId);
});

ipcMain.handle('sessions:delete', async (_event, { localId }) => {
  deleteSession(localId);
  return { ok: true };
});

ipcMain.handle('sessions:rename', async (_event, { localId, title }) => {
  const clean = (title || '').trim();
  if (!clean) return { ok: false };
  upsertSessionMeta(localId, { title: clean.length > 60 ? clean.slice(0, 60) + '…' : clean });
  return { ok: true };
});

ipcMain.handle('history:getColors', async () => loadColorHistory());

ipcMain.handle('history:getImages', async () => {
  try {
    return fs.readdirSync(uploadsDir)
      .map((name) => {
        const full = path.join(uploadsDir, name);
        const stat = fs.statSync(full);
        return { name, previewUrl: pathToFileURL(full).href, ts: stat.mtimeMs };
      })
      .sort((a, b) => b.ts - a.ts);
  } catch (e) {
    return [];
  }
});

ipcMain.handle('settings:get', async () => settings);

ipcMain.handle('settings:set', async (_event, partial) => {
  const previousHotkey = settings.hotkey;
  const previousEyedropperHotkey = settings.eyedropperHotkey;
  const previousWidget = settings.showFloatingWidget;
  settings = saveSettings(partial);

  if (partial.hotkey !== undefined && partial.hotkey !== previousHotkey) {
    const ok = registerNamedShortcut('screenshot', settings.hotkey, onScreenshotHotkey);
    if (!ok) {
      settings = saveSettings({ hotkey: previousHotkey });
      registerNamedShortcut('screenshot', previousHotkey, onScreenshotHotkey);
      return { ok: false, settings, error: 'Esse atalho já está em uso. Tenta outra combinação.' };
    }
  }

  if (partial.eyedropperHotkey !== undefined && partial.eyedropperHotkey !== previousEyedropperHotkey) {
    const ok = registerNamedShortcut('eyedropper', settings.eyedropperHotkey, () => openEyedropper());
    if (!ok) {
      settings = saveSettings({ eyedropperHotkey: previousEyedropperHotkey });
      registerNamedShortcut('eyedropper', previousEyedropperHotkey, () => openEyedropper());
      return { ok: false, settings, error: 'Esse atalho já está em uso. Tenta outra combinação.' };
    }
  }

  if (partial.showFloatingWidget !== undefined && partial.showFloatingWidget !== previousWidget) {
    if (partial.showFloatingWidget) {
      if (!widgetWindow || widgetWindow.isDestroyed()) createWidgetWindow();
    } else if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.destroy();
      widgetWindow = null;
    }
  }

  return { ok: true, settings };
});

ipcMain.handle('dialog:pickImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Escolher imagem do projeto',
    filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const buffer = fs.readFileSync(result.filePaths[0]);
  const ext = path.extname(result.filePaths[0]) || '.png';
  return saveBufferAsUpload(buffer, ext, 'img');
});

ipcMain.handle('screen:capture', async () => captureScreenNow());

ipcMain.handle('clipboard:saveImage', async (_event, { data, ext }) => {
  const buffer = Buffer.from(data);
  return saveBufferAsUpload(buffer, ext || '.png', 'colado');
});

ipcMain.handle('image:removeBackground', async (_event, { imageName }) => {
  const srcPath = path.join(uploadsDir, imageName);
  const destName = `semfundo-${Date.now()}.png`;
  const dest = path.join(uploadsDir, destName);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'bg-remove-worker.js'), srcPath, dest], {
      windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    });
    child.on('error', () => {
      resolve({ ok: false, error: 'Não consegui remover o fundo automaticamente. Tenta a remoção manual.' });
    });
    child.on('exit', (code) => {
      if (code === 0 && fs.existsSync(dest)) {
        resolve({ ok: true, name: destName, previewUrl: pathToFileURL(dest).href });
      } else {
        resolve({ ok: false, error: 'Não consegui remover o fundo automaticamente (pode ser falta de internet na primeira vez, ou o PC não suporta o modelo de IA). Tenta a remoção manual.' });
      }
    });
  });
});

ipcMain.handle('image:removeBackgroundManual', async (_event, { dataUrl }) => {
  try {
    const base64 = dataUrl.split(',')[1];
    const buf = Buffer.from(base64, 'base64');
    const destName = `semfundo-manual-${Date.now()}.png`;
    const dest = path.join(uploadsDir, destName);
    fs.writeFileSync(dest, buf);
    return { ok: true, name: destName, previewUrl: pathToFileURL(dest).href };
  } catch (e) {
    return { ok: false, error: 'Não consegui salvar a imagem editada.' };
  }
});

ipcMain.handle('image:enhance', async (_event, { imageName }) => {
  try {
    const srcPath = path.join(uploadsDir, imageName);
    const meta = await sharp(srcPath).metadata();
    let pipeline = sharp(srcPath).normalize().sharpen({ sigma: 1 });
    const maxSide = Math.max(meta.width || 0, meta.height || 0);
    if (maxSide > 0 && maxSide < 1000) {
      const scale = Math.min(2, 1400 / maxSide);
      pipeline = pipeline.resize({ width: Math.round((meta.width || 0) * scale), kernel: 'lanczos3' });
    }
    const destName = `melhorada-${Date.now()}.png`;
    const dest = path.join(uploadsDir, destName);
    await pipeline.png().toFile(dest);
    return { ok: true, name: destName, previewUrl: pathToFileURL(dest).href };
  } catch (e) {
    return { ok: false, error: 'Não consegui melhorar essa imagem.' };
  }
});

ipcMain.handle('image:loadForEditing', async (_event, { imageName }) => {
  const srcPath = path.join(uploadsDir, imageName);
  const buf = fs.readFileSync(srcPath);
  return `data:image/png;base64,${buf.toString('base64')}`;
});

ipcMain.handle('image:download', async (_event, { imageName }) => {
  const srcPath = path.join(uploadsDir, imageName);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Salvar imagem',
    defaultPath: imageName,
    filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false };
  fs.copyFileSync(srcPath, result.filePath);
  return { ok: true };
});

ipcMain.on('widget:clicked', () => {
  const origin = widgetWindow && !widgetWindow.isDestroyed() ? widgetWindow.getBounds() : null;
  toggleMainWindowFrom(origin);
});

ipcMain.on('widget:dragBy', (_event, dx, dy) => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    const [x, y] = widgetWindow.getPosition();
    const newX = Math.round(x + dx);
    const newY = Math.round(y + dy);
    widgetWindow.setPosition(newX, newY);
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      const { rect } = computeFlyoutPlacement(mainWindow, { x: newX, y: newY, width: 64, height: 64 });
      mainWindow.setBounds(rect);
    }
  }
});

ipcMain.on('widget:close', () => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.destroy();
  }
  widgetWindow = null;
});

ipcMain.on('editor:enterFullscreen', () => enterEditorFullscreen());
ipcMain.on('editor:exitFullscreen', () => exitEditorFullscreen());

ipcMain.on('eyedropper:open', () => openEyedropper());

ipcMain.on('eyedropper:picked', (_event, hex) => {
  closeEyedropper();
  showMainWindow();
  addColorToHistory(hex);
  if (mainWindow) mainWindow.webContents.send('eyedropper:result', hex);
});

ipcMain.on('eyedropper:cancelled', () => closeEyedropper());
