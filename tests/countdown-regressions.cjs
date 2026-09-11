const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { launchElectron } = require('./electron-driver.cjs');

async function main() {
  assert.equal(process.env.CONDA_DEFAULT_ENV, 'JK');
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, '.qa/countdown');
  fs.mkdirSync(output, { recursive: true });
  process.env.XIAOJD_TEST_EXE = path.join(root, require('../package.json').build.directories.output, 'win-unpacked/小决定 Desktop.exe');
  const env = { ...process.env, XIAOJD_TEST_DATA: fs.mkdtempSync(path.join(os.tmpdir(), 'xiaojd-countdown-')) };
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await launchElectron(root, env);
    const page = app.windows().find((window) => !window.url().includes('mode='));
    await page.getByRole('button', { name: '倒计时', exact: true }).waitFor();
    await page.getByRole('button', { name: '倒计时', exact: true }).click();
    await page.getByRole('button', { name: '添加倒计时', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '编辑倒计时', exact: true });
    const target = new Date(Date.now() + 2 * 86400000);
    const reminder = new Date(Date.now() + 65000);
    reminder.setSeconds(0, 0);
    const date = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
    const hhmm = `${String(reminder.getHours()).padStart(2, '0')}:${String(reminder.getMinutes()).padStart(2, '0')}`;
    await dialog.getByLabel('倒计时名称', { exact: true }).fill('项目截止');
    await dialog.locator('input[type="date"]').fill(date);
    await dialog.locator('input[type="time"]').fill(hhmm);
    await dialog.getByRole('button', { name: '保存倒计时', exact: true }).click();
    await page.locator('.countdown-row').waitFor();
    await page.screenshot({ path: path.join(output, 'countdown-workspace.png') });
    const configured = await page.evaluate(() => window.desktop.getScheduler());
    assert.equal(configured.countdowns.length, 1);
    assert.equal(configured.countdowns[0].name, '项目截止');
    assert.equal(await page.locator('.countdown-hero h3').textContent(), '项目截止');

    const popupPromise = app.waitForEvent('window', { timeout: 75000 });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((window) => !window.webContents.getURL().includes('mode=countdown')).close());
    const popup = await popupPromise;
    await popup.getByText('每日倒计时提醒').waitFor();
    assert.equal(await popup.locator('.countdown-popup h1').textContent(), '项目截止');
    assert.match(await popup.locator('.countdown-popup-copy').textContent(), /距离目标日期还有/);
    assert.match(await popup.locator('.countdown-popup-digits').textContent(), /天/);
    await popup.screenshot({ path: path.join(output, 'countdown-popup.png') });
    await Promise.all([popup.waitForEvent('close'), popup.getByRole('button', { name: '知道了', exact: true }).click()]);

    await app.close(); app = undefined;
    app = await launchElectron(root, env);
    const restarted = app.windows().find((window) => !window.url().includes('mode='));
    await restarted.getByRole('button', { name: '倒计时', exact: true }).waitFor();
    const restored = await restarted.evaluate(() => window.desktop.getScheduler());
    assert.equal(restored.countdowns.length, 1);
    assert.equal(restored.countdownAlert.acknowledged, true);
    assert.equal(app.windows().filter((window) => window.url().includes('mode=countdown')).length, 0);
    await restarted.evaluate(async () => {
      const snapshot = await window.desktop.getScheduler();
      await window.desktop.saveCountdowns(snapshot.countdowns.map((item) => ({ ...item, enabled: false })));
    });
    await app.close(); app = undefined;
    console.log('PASS countdown form, background reminder popup, remaining duration, acknowledgement and persistence');
  } finally {
    if (app) await app.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
