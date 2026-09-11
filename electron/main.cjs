const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, powerMonitor, Notification } = require("electron");
const path = require("path");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const {
  validateSchedules, validateWheels, validateCountdowns,
  nextRun, dueSlot, nextCountdownRun, dueCountdownSlot, countdownRemainingMs,
  pickWeighted
} = require('./scheduler.cjs');

const isDev = !app.isPackaged;
let mainWindow;
let resultWindow;
let countdownWindow;
let tray;
let quitting = false;
let schedulerPath;
let storageError = '';
let data = { wheels: [], schedules: [], results: [], runs: {}, activated: {}, countdowns: [], countdownRuns: {}, countdownActivated: {}, countdownAlert: null };
const pendingTimers = new Set();
let clockTimer;
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
if (process.env.XIAOJD_TEST_DATA) app.setPath('userData', process.env.XIAOJD_TEST_DATA);

function saveData(next) {
  fs.mkdirSync(path.dirname(schedulerPath), { recursive: true });
  fs.writeFileSync(schedulerPath + '.tmp', JSON.stringify(next, null, 2));
  fs.renameSync(schedulerPath + '.tmp', schedulerPath);
  data = next;
  storageError = '';
}
function snapshot() {
  return { schedules: data.schedules.map((schedule) => ({ ...schedule, nextRunAt: nextRun(schedule) })),
    results: data.results,
    countdowns: data.countdowns.map((countdown) => ({ ...countdown, nextRunAt: nextCountdownRun(countdown) })),
    countdownAlert: data.countdownAlert,
    autoStart: app.getLoginItemSettings({ path: process.execPath, args: ['--background'] }).openAtLogin,
    error: storageError };
}
function broadcast() {
  for (const window of [mainWindow, resultWindow, countdownWindow]) {
    if (window && !window.isDestroyed()) window.webContents.send('scheduler:changed', snapshot());
  }
}
function openPage(window, mode) {
  if (isDev && !process.env.XIAOJD_TEST_STATIC) window.loadURL(`http://127.0.0.1:1420/${mode ? '?mode=' + mode : ''}`);
  else window.loadFile(path.join(__dirname, '../dist/index.html'), mode ? { query: { mode } } : {});
}
function showMain() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 800,
    minWidth: 840,
    minHeight: 620,
    title: "小决定 Desktop",
    backgroundColor: "#eef2f6",
    autoHideMenuBar: true,
    show: !process.argv.includes('--background'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });

  Menu.setApplicationMenu(null);

  mainWindow.on('close', (event) => {
    if (!quitting && data.schedules.some((schedule) => schedule.enabled)) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  openPage(mainWindow);
}

function showResults() {
  if (!data.results[0] || data.results[0].acknowledged) return;
  if (!resultWindow || resultWindow.isDestroyed()) {
    resultWindow = new BrowserWindow({ width: 620, height: 730, minWidth: 400, minHeight: 500,
      title: '定时转盘结果', backgroundColor: '#ffffff', autoHideMenuBar: true, alwaysOnTop: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false } });
    resultWindow.on('closed', () => { resultWindow = null; });
    openPage(resultWindow, 'scheduled');
  } else {
    resultWindow.show();
    if (resultWindow.isMinimized()) resultWindow.restore();
  }
}
function showCountdown() {
  if (!data.countdownAlert || data.countdownAlert.acknowledged) return;
  if (!countdownWindow || countdownWindow.isDestroyed()) {
    countdownWindow = new BrowserWindow({ width: 560, height: 470, minWidth: 420, minHeight: 380,
      title: '倒计时提醒', backgroundColor: '#ffffff', autoHideMenuBar: true, alwaysOnTop: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false } });
    countdownWindow.on('closed', () => { countdownWindow = null; });
    openPage(countdownWindow, 'countdown');
  } else {
    countdownWindow.show();
    if (countdownWindow.isMinimized()) countdownWindow.restore();
    countdownWindow.focus();
  }
}
function hasBackgroundTasks() {
  return data.schedules.some((schedule) => schedule.enabled) || data.countdowns.some((countdown) => nextCountdownRun(countdown) !== null);
}
function formatCountdownRemaining(ms) {
  if (ms <= 0) return '目标日期已到';
  const totalSeconds = Math.ceil(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}天 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
function tick() {
  const now = new Date();
  for (const schedule of data.schedules) {
    const slot = dueSlot(schedule, now, data.runs[schedule.id], data.activated[schedule.id]);
    if (slot === null) continue;
    const wheel = data.wheels.find((item) => item.id === schedule.wheelId);
    if (!wheel) continue;
    const selected = pickWeighted(wheel.options);
    const result = { id: randomUUID(), scheduleId: schedule.id, wheel, optionId: selected.id, result: selected.label,
      startedAt: now.toISOString(), completedAt: new Date(now.getTime() + wheel.spinDurationMs).toISOString(), scheduledAt: new Date(slot).toISOString(), acknowledged: false };
    try {
      // Commit the result and slot together before displaying, preventing duplicate runs on restart.
      saveData({ ...data, runs: { ...data.runs, [schedule.id]: slot },
        results: [result, ...data.results.map((previous) => ({ ...previous, acknowledged: true }))].slice(0, 200) });
      showResults();
      broadcast();
      const timer = setTimeout(() => {
        pendingTimers.delete(timer);
        broadcast();
        // Superseded runs stay in history but must not reopen an old popup or notification.
        if (data.results[0]?.id !== result.id || data.results[0].acknowledged) return;
        showResults();
        if (Notification.isSupported()) {
          const notification = new Notification({ title: `定时转盘 · ${wheel.name}`, body: selected.label, silent: true });
          notification.on('click', showResults);
          notification.show();
        }
      }, wheel.spinDurationMs);
      pendingTimers.add(timer);
    } catch (error) {
      storageError = `定时结果保存失败：${error.message}`;
      broadcast();
    }
  }
  for (const countdown of data.countdowns) {
    const slot = dueCountdownSlot(countdown, now, data.countdownRuns[countdown.id], data.countdownActivated[countdown.id]);
    if (slot === null) continue;
    const alert = { id: randomUUID(), countdownId: countdown.id, name: countdown.name, targetDate: countdown.targetDate,
      remindedAt: now.toISOString(), acknowledged: false };
    try {
      saveData({ ...data, countdownRuns: { ...data.countdownRuns, [countdown.id]: slot }, countdownAlert: alert });
      showCountdown();
      broadcast();
      if (Notification.isSupported()) {
        const notification = new Notification({ title: `倒计时提醒 · ${countdown.name}`, body: formatCountdownRemaining(countdownRemainingMs(countdown, now)), silent: true });
        notification.on('click', showCountdown);
        notification.show();
      }
    } catch (error) {
      storageError = `倒计时提醒保存失败：${error.message}`;
      broadcast();
    }
  }
}
function installIpc() {
  function handle(channel, fn, mainOnly = false) {
    ipcMain.handle(channel, (event, value) => {
      const allowed = mainOnly ? [mainWindow] : [mainWindow, resultWindow, countdownWindow];
      // The bridge is exposed only to the three windows created by this process.
      // Electron can wrap the main frame in a distinct WebFrameMain object after loadFile;
      // webContents identity is the stable authority check here.
      if (!allowed.some((window) => window && !window.isDestroyed() && window.webContents === event.sender)) throw new Error('无效的窗口');
      return fn(value);
    });
  }
  handle('scheduler:get', snapshot);
  handle('scheduler:wheels', (wheels) => {
    const valid = validateWheels(wheels);
    const schedules = data.schedules.filter((schedule) => valid.some((wheel) => wheel.id === schedule.wheelId));
    saveData({ ...data, wheels: valid, schedules });
    broadcast();
    return snapshot();
  }, true);
  handle('scheduler:save', (schedules) => {
    const valid = validateSchedules(schedules, data.wheels);
    const activated = { ...data.activated };
    for (const schedule of valid) {
      const old = data.schedules.find((item) => item.id === schedule.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(schedule)) activated[schedule.id] = Date.now();
    }
    saveData({ ...data, schedules: valid, activated });
    broadcast();
    return snapshot();
  }, true);
  handle('scheduler:autostart', (enabled) => {
    if (typeof enabled !== 'boolean') throw new Error('设置无效');
    app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: ['--background'] });
    broadcast();
    return snapshot();
  }, true);
  handle('scheduler:ack', (ids) => {
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) throw new Error('结果编号无效');
    saveData({ ...data, results: data.results.map((result) => ids.includes(result.id) && Date.parse(result.completedAt) <= Date.now() ? { ...result, acknowledged: true } : result) });
    broadcast();
    if (!data.results[0] || data.results[0].acknowledged) resultWindow?.close();
    return snapshot();
  });
  handle('scheduler:clear-history', () => {
    saveData({ ...data, results: data.results.filter((result) => Date.parse(result.completedAt) > Date.now()) });
    broadcast();
    if (!data.results[0] || data.results[0].acknowledged) resultWindow?.close();
    return snapshot();
  }, true);
  handle('countdown:save', (countdowns) => {
    const valid = validateCountdowns(countdowns);
    const countdownActivated = { ...data.countdownActivated };
    for (const countdown of valid) {
      const old = data.countdowns.find((item) => item.id === countdown.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(countdown)) countdownActivated[countdown.id] = Date.now();
    }
    const exists = valid.some((countdown) => countdown.id === data.countdownAlert?.countdownId);
    saveData({ ...data, countdowns: valid, countdownActivated, countdownAlert: exists ? data.countdownAlert : null });
    broadcast();
    if (!data.countdownAlert) countdownWindow?.close();
    return snapshot();
  }, true);
  handle('countdown:ack', (id) => {
    if (typeof id !== 'string') throw new Error('倒计时提醒编号无效');
    if (data.countdownAlert?.id === id) saveData({ ...data, countdownAlert: { ...data.countdownAlert, acknowledged: true } });
    broadcast();
    countdownWindow?.close();
    return snapshot();
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', showMain);
  app.whenReady().then(() => {
    schedulerPath = path.join(app.getPath('userData'), 'scheduler.json');
    if (fs.existsSync(schedulerPath)) {
      try {
        const stored = JSON.parse(fs.readFileSync(schedulerPath, 'utf8'));
        const wheels = validateWheels(stored.wheels);
        data = { wheels, schedules: validateSchedules(stored.schedules, wheels),
          results: (stored.results || []).map((result, index) => index === 0 ? result : { ...result, acknowledged: true }),
          runs: stored.runs || {}, activated: stored.activated || {},
          countdowns: validateCountdowns(stored.countdowns || []), countdownRuns: stored.countdownRuns || {},
          countdownActivated: stored.countdownActivated || {}, countdownAlert: stored.countdownAlert || null };
      } catch (error) { storageError = `定时设置读取失败：${error.message}`; }
    }
    Menu.setApplicationMenu(null);
    installIpc();
    createWindow();
    const iconPath = path.join(__dirname, isDev ? '../public/reference/images/coin_chinese_heads.png' : '../dist/reference/images/coin_chinese_heads.png');
    tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 }));
    tray.setToolTip('小决定 · 定时转盘');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '打开小决定', click: showMain }, { label: '当前定时结果', click: showResults }, { label: '当前倒计时提醒', click: showCountdown }, { type: 'separator' },
      { label: '退出（停止定时任务）', click: () => app.quit() }
    ]));
    tray.on('double-click', showMain);
    clockTimer = setInterval(tick, 1000);
    powerMonitor.on('resume', tick);
    showResults();
    showCountdown();
    app.on('activate', showMain);
  });
}
app.on('before-quit', () => {
  quitting = true;
  clearInterval(clockTimer);
  for (const timer of pendingTimers) clearTimeout(timer);
});
app.on('window-all-closed', () => {
  if (!hasBackgroundTasks()) app.quit();
});
