const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { launchElectron } = require('./electron-driver.cjs');

async function main() {
  assert.equal(process.env.CONDA_DEFAULT_ENV, 'JK');
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, '.qa/v0.2.1');
  fs.mkdirSync(output, { recursive: true });
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaojd-interactions-'));
  process.env.XIAOJD_TEST_EXE = path.join(root, require('../package.json').build.directories.output, 'win-unpacked/小决定 Desktop.exe');
  const env = { ...process.env, XIAOJD_TEST_DATA: userData };
  delete env.ELECTRON_RUN_AS_NODE;
  const wheel = { id: 'default-minister', name: '历史测试转盘', spinDurationMs: 1200, options: [
    { id: 'a', label: '当前结果', color: '#ee3344', weight: 1 }, { id: 'b', label: '旧结果', color: '#2288ee', weight: 1 }
  ] };
  const done = new Date(Date.now() - 60000).toISOString();
  const result = { scheduleId: 'legacy', wheel, startedAt: done, completedAt: done, scheduledAt: done, acknowledged: false };
  fs.writeFileSync(path.join(userData, 'scheduler.json'), JSON.stringify({ wheels: [wheel], schedules: [], runs: {}, activated: {}, results: [
    { ...result, id: 'current', result: '当前结果', optionId: 'a' }, { ...result, id: 'old', result: '旧结果', optionId: 'b' }
  ] }));
  let app;
  try {
    app = await launchElectron(root, env);
    const page = app.windows().find((window) => !window.url().includes('mode=scheduled'));
    await page.getByRole('button', { name: '选项', exact: true }).waitFor();
    const popup = app.windows().find((window) => window.url().includes('mode=scheduled')) ?? await app.waitForEvent('window');
    await popup.locator('.scheduled-result').waitFor();
    assert.equal(await popup.locator('.scheduled-card').count(), 1);
    assert.equal(await popup.locator('.scheduled-result').textContent(), '当前结果');
    const initial = await popup.evaluate(() => window.desktop.getScheduler());
    assert.equal(initial.results.length, 2);
    assert.equal(initial.results[1].acknowledged, true);
    await Promise.all([popup.waitForEvent('close'), popup.getByRole('button', { name: '知道了' }).click()]);
    console.log('PASS legacy accumulated results show current only, preserve history, close without revealing older');

    await page.getByRole('button', { name: '选项', exact: true }).click();
    const options = page.getByRole('dialog', { name: '转盘选项', exact: true });
    await page.mouse.click(8, 8);
    await page.keyboard.press('Escape');
    assert.equal(await options.isVisible(), true);
    await options.getByRole('button', { name: '关闭', exact: true }).click();
    await page.locator('.wheel-stage-panel .workspace-toolbar').getByRole('button', { name: '编辑', exact: true }).click();
    const editor = page.getByRole('dialog', { name: '编辑转盘', exact: true });
    const original = await editor.getByLabel('名称', { exact: true }).inputValue();
    await editor.getByLabel('名称', { exact: true }).fill('保留中的草稿');
    await page.mouse.click(8, 8); await page.keyboard.press('Escape');
    assert.equal(await editor.isVisible(), true);
    assert.equal(await editor.getByLabel('名称', { exact: true }).inputValue(), '保留中的草稿');
    await editor.locator('.option-color-dot').first().click();
    await page.mouse.click(8, 8); await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog', { name: '颜色选择' }).isVisible(), true);
    await page.getByRole('dialog', { name: '颜色选择' }).getByRole('button', { name: '关闭', exact: true }).click();
    await editor.locator('.weight-pill').first().click();
    await page.mouse.click(8, 8); await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog', { name: '权重编辑' }).isVisible(), true);
    await page.getByRole('dialog', { name: '权重编辑' }).getByRole('button', { name: '关闭', exact: true }).click();
    await editor.getByRole('button', { name: '删除', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: '删除转盘', exact: true });
    await confirmation.waitFor();
    await page.mouse.click(8, 8); await page.keyboard.press('Escape');
    assert.equal(await confirmation.isVisible(), true);
    await confirmation.getByRole('button', { name: '取消', exact: true }).click();
    assert.equal(await editor.getByLabel('名称', { exact: true }).inputValue(), '保留中的草稿');
    await editor.getByLabel('名称', { exact: true }).fill(original);
    await editor.getByLabel('动画时长', { exact: true }).fill('1200');
    await editor.getByRole('button', { name: '保存', exact: true }).click();
    assert.equal(await editor.count(), 0);
    console.log('PASS all backdrops and Escape ignored, delete requires confirmation, cancel preserves draft, save closes');

    // Same-target restarts must also work: retain one enabled option to make the draw deterministic.
    await page.getByRole('button', { name: '选项', exact: true }).click();
    const checks = options.locator('.floating-option input');
    for (let index = 1; index < await checks.count(); index++) await checks.nth(index).uncheck();
    await options.getByRole('button', { name: '关闭', exact: true }).click();
    const spin = page.getByRole('button', { name: '旋转转盘', exact: true });
    await spin.click(); await page.waitForTimeout(750);
    assert.equal(await spin.isEnabled(), true);
    await spin.click(); await page.waitForTimeout(550);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('xiaojd-desktop:v1')).history.filter((item) => item.type === 'wheel').length), 0);
    await spin.click();
    for (let i = 0; i < 4; i++) { await page.waitForTimeout(80); await spin.click(); }
    const angle1 = await page.locator('.decision-wheel').evaluate((element) => getComputedStyle(element).transform);
    await page.waitForTimeout(200);
    const angle2 = await page.locator('.decision-wheel').evaluate((element) => getComputedStyle(element).transform);
    assert.notEqual(angle1, angle2);
    await page.waitForTimeout(1200);
    const spins = await page.evaluate(() => JSON.parse(localStorage.getItem('xiaojd-desktop:v1')).history.filter((item) => item.type === 'wheel'));
    assert.equal(spins.length, 1);
    assert.equal(await page.locator('.desktop-wheel-result strong').textContent(), spins[0].result);
    await page.screenshot({ path: path.join(output, 'repeat-spin.png') });
    console.log('PASS pointer always enabled, rapid same-target animation restarts, cancelled runs never record results');

    // A newly-created wheel supplies a safe, isolated deletion target with an associated schedule.
    await page.getByRole('button', { name: '新建', exact: true }).click();
    const newId = await page.evaluate(() => JSON.parse(localStorage.getItem('xiaojd-desktop:v1')).activeWheelId);
    await page.waitForTimeout(300);
    await page.evaluate(async (id) => {
      await window.desktop.saveSchedules([{ id: 'delete-test', wheelId: id, startTime: '01:00', endTime: '02:00', intervalMinutes: 30, enabled: false }]);
    }, newId);
    await editor.getByRole('button', { name: '删除', exact: true }).click();
    await confirmation.getByRole('button', { name: '确认删除', exact: true }).click();
    assert.equal(await editor.count(), 0);
    await page.waitForFunction(async () => !(await window.desktop.getScheduler()).schedules.some((item) => item.id === 'delete-test'));
    assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem('xiaojd-desktop:v1')).wheels.some((wheel) => wheel.id === id), newId), false);
    console.log('PASS confirmed deletion removes wheel and associated task');

    await page.getByRole('button', { name: '定时转动', exact: true }).click();
    await page.getByRole('button', { name: '添加定时', exact: true }).click();
    const scheduleDialog = page.getByRole('dialog', { name: '定时任务' });
    await page.mouse.click(8, 8); await page.keyboard.press('Escape');
    assert.equal(await scheduleDialog.isVisible(), true);
    await scheduleDialog.getByRole('button', { name: '关闭', exact: true }).click();
    const scheduled = await page.evaluate(async () => {
      const wheels = JSON.parse(localStorage.getItem('xiaojd-desktop:v1')).wheels;
      await window.desktop.syncWheels(wheels.map((wheel, index) => ({ ...wheel, spinDurationMs: index === 0 ? 8000 : 1200 })));
      const start = new Date(Date.now() + 65000); start.setSeconds(0, 0);
      const end = new Date(+start + 120000);
      const hhmm = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      await window.desktop.saveSchedules(wheels.slice(0, 2).map((wheel, index) => ({ id: `simultaneous-${index}`, wheelId: wheel.id, startTime: hhmm(start), endTime: hhmm(end), intervalMinutes: 1, enabled: true })));
      return start.toISOString();
    });
    const appeared = app.waitForEvent('window', { timeout: 75000 });
    console.log('WAIT two simultaneous background tasks at', scheduled);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((window) => !window.webContents.getURL().includes('mode=scheduled')).close());
    const latestPopup = await appeared;
    await latestPopup.locator('.scheduled-result').waitFor();
    await latestPopup.waitForFunction(() => !document.querySelector('.scheduled-card .save-button').disabled);
    assert.equal(await latestPopup.locator('.scheduled-card').count(), 1);
    const state = await latestPopup.evaluate(() => window.desktop.getScheduler());
    assert.equal(state.results[0].scheduleId, 'simultaneous-1');
    assert.equal(state.results[1].scheduleId, 'simultaneous-0');
    assert.equal(state.results[1].acknowledged, true);
    assert.equal(await latestPopup.locator('.scheduled-result').textContent(), state.results[0].result);
    await latestPopup.screenshot({ path: path.join(output, 'current-scheduled-result.png') });
    await latestPopup.getByRole('button', { name: '知道了', exact: true }).click();
    await page.waitForTimeout(8500);
    assert.equal(app.windows().filter((window) => window.url().includes('mode=scheduled')).length, 0);
    await page.evaluate(async () => { const state = await window.desktop.getScheduler(); await window.desktop.saveSchedules(state.schedules.map((item) => ({ ...item, enabled: false }))); });
    await app.close(); app = undefined;
    app = await launchElectron(root, env);
    await (await app.firstWindow()).getByRole('button', { name: '选项', exact: true }).waitFor();
    assert.equal(app.windows().filter((window) => window.url().includes('mode=scheduled')).length, 0);
    console.log('PASS simultaneous tasks replace previous result, retain history, no stale completion/restart popup');
  } finally { if (app) await app.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
