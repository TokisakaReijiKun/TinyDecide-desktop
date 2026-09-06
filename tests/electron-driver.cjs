const { spawn } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/A1512/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

// Electron 42's inspector startup differs from the bundled Playwright launch helper.
// Connect to its published browser/Node endpoints directly for this local integration test.
async function launchElectron(root, env) {
  const executable = process.env.XIAOJD_TEST_EXE || require('electron');
  const child = spawn(executable, ['--disable-gpu', '--inspect=0', '--remote-debugging-port=0', ...(process.env.XIAOJD_TEST_EXE ? [] : ['.'])], { cwd: root, env, windowsHide: true, stdio: 'pipe' });
  const urls = await new Promise((resolve, reject) => {
    const found = {};
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Electron endpoints timed out')); }, 30000);
    child.stderr.on('data', (data) => {
      const text = data.toString();
      const debug = text.match(/Debugger listening on (ws:\/\/\S+)/);
      const browser = text.match(/DevTools listening on (ws:\/\/\S+)/);
      if (debug) found.node = debug[1];
      if (browser) found.browser = browser[1];
      if (found.node && found.browser) { clearTimeout(timeout); resolve(found); }
      if (/Error|error/i.test(text)) process.stderr.write(text);
    });
    child.on('exit', (code) => { clearTimeout(timeout); reject(new Error('Electron exited ' + code)); });
  });
  const inspector = new WebSocket(urls.node);
  await new Promise((resolve, reject) => { inspector.onopen = resolve; inspector.onerror = reject; });
  let id = 0;
  const pending = new Map();
  inspector.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
    if (message.error || message.result?.exceptionDetails) reject(new Error(JSON.stringify(message)));
    else resolve(message.result.result?.value);
  };
  const evaluate = (fn) => new Promise((resolve, reject) => {
    const current = ++id; pending.set(current, { resolve, reject });
    inspector.send(JSON.stringify({ id: current, method: 'Runtime.evaluate', params: {
      expression: `(${fn.toString()})(process.mainModule.require('electron'))`, returnByValue: true, awaitPromise: true
    } }));
  });
  await evaluate(async ({ app, BrowserWindow }) => {
    await app.whenReady();
    return new Promise((resolve) => {
      let attempts = 0;
      const timer = setInterval(() => {
        const window = BrowserWindow.getAllWindows()[0];
        if ((window && window.webContents.getURL() && !window.webContents.isLoading()) || ++attempts > 300) {
          clearInterval(timer); resolve(window?.webContents.getURL());
        }
      }, 100);
    });
  });
  const browser = await chromium.connectOverCDP(urls.browser, { timeout: 30000 }).catch((error) => { inspector.close(); child.kill(); throw error; });
  const context = browser.contexts()[0];
  return {
    windows: () => context.pages(),
    firstWindow: async () => context.pages()[0] ?? await context.waitForEvent('page'),
    waitForEvent: (_name, options) => context.waitForEvent('page', options),
    evaluate,
    close: async () => {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      // Schedule quit so the inspector can acknowledge before its socket closes.
      await evaluate(({ app }) => { setTimeout(() => app.quit(), 100); return true; }).catch(() => {});
      inspector.close();
      await browser.close().catch(() => {});
      const fallback = setTimeout(() => child.kill(), 5000);
      await exited; clearTimeout(fallback);
    }
  };
}
module.exports = { launchElectron };
