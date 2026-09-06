const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { launchElectron } = require('./electron-driver.cjs');

async function main() {
  assert.equal(process.env.CONDA_DEFAULT_ENV, 'JK');
  const root = path.resolve(__dirname, '..');
  process.env.XIAOJD_TEST_EXE = path.join(root, require('../package.json').build.directories.output, 'win-unpacked/小决定 Desktop.exe');
  const env = { ...process.env, XIAOJD_TEST_DATA: fs.mkdtempSync(path.join(os.tmpdir(), 'xiaojd-artifact-')) };
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await launchElectron(root, env);
    const page = await app.firstWindow();
    await page.getByRole('button', { name: '选项', exact: true }).waitFor();
    assert.equal(await app.evaluate(({ app }) => app.isPackaged), true);
    const media = await page.evaluate(async () => {
      const names = ['chinese', 'chip', 'constantine', 'panda', 'pirate', 'rome'];
      const report = [];
      for (const name of names) {
        for (const from of ['heads', 'tails']) for (const to of ['heads', 'tails']) {
          const video = document.createElement('video'); video.muted = true;
          video.src = new URL(`reference/videos/coins/${name}/${from}_to_${to}_light.mp4`, location.href).href;
          const data = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Video timeout ' + video.src)), 6000);
            video.onloadeddata = () => { clearTimeout(timer); resolve({ name, from, to, width: video.videoWidth, duration: video.duration }); };
            video.onerror = () => { clearTimeout(timer); reject(new Error('Video unreadable ' + video.src)); };
            video.load();
          });
          report.push(data); video.removeAttribute('src'); video.load();
        }
      }
      for (const name of ['tick', 'win', 'pop']) {
        const audio = new Audio(new URL(`reference/sounds/${name}.wav`, location.href).href);
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Audio timeout ' + name)), 6000);
          audio.oncanplay = () => { clearTimeout(timer); resolve(); };
          audio.onerror = () => { clearTimeout(timer); reject(new Error('Audio unreadable ' + name)); };
          audio.load();
        });
        report.push({ sound: name, duration: audio.duration });
      }
      return report;
    });
    assert.equal(media.length, 27);
    assert.ok(media.every((entry) => entry.duration > 0));
    await page.getByRole('button', { name: '抛硬币', exact: true }).first().click();
    await page.locator('.coin-command').click();
    await page.waitForFunction(() => document.querySelector('.coin-media video')?.currentTime > 0.2);
    const first = await page.locator('video').evaluate((video) => {
      const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 96;
      canvas.getContext('2d').drawImage(video, 0, 0, 64, 96); return canvas.toDataURL();
    });
    await page.waitForTimeout(350);
    const second = await page.locator('video').evaluate((video) => {
      const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 96;
      canvas.getContext('2d').drawImage(video, 0, 0, 64, 96); return canvas.toDataURL();
    });
    assert.notEqual(first, second);
    await page.waitForFunction(() => !document.querySelector('.coin-command').disabled);
    await page.waitForFunction(() => { const image = document.querySelector('.coin-media img'); return image?.complete && image.naturalWidth > 0; });
    assert.equal(await page.locator('.coin-media img').evaluate((image) => {
      const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, 64, 64);
      return [...context.getImageData(0, 0, 64, 64).data].some((value, index) => index % 4 === 3 && value > 0);
    }), true);
    await page.screenshot({ path: path.join(root, '.qa/packaged-coin.png') });
    await page.getByRole('button', { name: '随机数字', exact: true }).click();
    await page.getByLabel('数量', { exact: true }).fill('9');
    await page.evaluate(() => {
      window.numberChanges = [];
      new MutationObserver(() => window.numberChanges.push(performance.now())).observe(document.querySelector('.number-results'), { subtree: true, childList: true, characterData: true });
    });
    await page.getByRole('button', { name: '生成', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.number-main-panel .primary-pill').disabled);
    const changes = await page.evaluate(() => window.numberChanges);
    assert.ok(changes.length >= 6 && changes.length < 30, 'CurvedTimer update count');
    const intervals = changes.slice(1).map((time, i) => time - changes[i]);
    assert.ok(Math.max(...intervals.slice(-3)) > Math.min(...intervals.slice(0, 3)) * 2, 'Number updates decelerate');
    await page.screenshot({ path: path.join(root, '.qa/packaged-numbers.png') });
    await page.getByRole('button', { name: '定时转动', exact: true }).click();
    await page.getByRole('button', { name: '添加定时', exact: true }).click();
    await page.screenshot({ path: path.join(root, '.qa/packaged-schedule-form.png') });
    await page.getByRole('dialog', { name: '定时任务' }).getByRole('button', { name: '关闭', exact: true }).click();
    const state = await page.evaluate(() => window.desktop.getScheduler());
    assert.equal(state.error, '');
    console.log('PASS packaged EXE, bridge, 24 video decodes, 3 audio decodes, moving frames, visible final coin, decelerating number refresh', intervals.map(Math.round));
  } finally { if (app) await app.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
