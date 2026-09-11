# 小决定 Desktop

一个本地离线的 Windows 桌面随机决策工具，使用 Electron + React + TypeScript + Vite 构建。当前版本 0.3.0；旧 Tauri 壳仍保留，但每日定时、倒计时和系统托盘功能使用 Electron。

## 0.3.0 更新

- 新增倒计时：指定名称、目标日期和每日提醒时刻。
- 每天到达提醒时刻时弹出剩余天数、时、分、秒；目标日当天显示“目标日期已到”。
- 倒计时由 Electron 后台计时，主窗口关闭到托盘后仍能提醒；确认提醒后不会重复弹出。

## 0.2.1 更新

- 浮层不再被外部点击或 Esc 关闭，使用关闭按钮或保存按钮操作。删除转盘需要再次确认，取消确认会保留编辑草稿。
- 转盘运行中指针始终可点击；参考 APK 的控制器重置逻辑，每次点击重新抽取目标并重新开始，最终只记录最后完成的一轮。
- 定时弹窗仅展示最新一次结果；旧结果保留在历史中，旧动画结束不会再次弹窗。
- 默认构建只生成免安装 EXE，不生成安装器。

## 0.2.0 更新

- 转盘跨扇区音效、结束音效、可保存的音效开关。
- 转盘选项和编辑窗口采用浮层，关闭未保存的编辑不会改动现有转盘。
- 随机数字采用参考 APK 的 CurvedTimer 减速刷新逻辑，单个大数字或多个网格结果。分析依据见 `docs/apk-animation-analysis.md`。
- 抛硬币包含参考 APK 的六种款式和完整正反面转换视频，并记录历史。
- 每日定时任务可指定转盘、起止时间和分钟间隔，支持跨午夜、多任务、暂停、编辑、删除和开机启动。

## 每日定时规则

使用电脑本地时间，在开始时间执行第一次，再按间隔执行；结束时间若恰好落在间隔点上也执行。结束早于开始视为次日结束，不支持相同的起止时间。

启用任务后关闭主窗口会保留系统托盘，后台继续运行。托盘“退出（停止定时任务）”才会完全退出。电脑关机、睡眠或程序完全退出期间不会执行，也不会在恢复后集中补发过期结果。需要每日自动运行时，可在“定时转动”中开启“开机启动”。

每次定时执行都会显示转动过程及当前结果弹窗，并保存记录；最新未读结果可从托盘重新打开，旧结果仅保留在历史中。任务和结果保存在应用用户数据目录的 `scheduler.json`。

## 项目环境

本项目所有分析、构建和测试均在 conda `JK` 环境中执行。Node/npm 通过此环境的 PATH 使用；无需迁移为 Python 项目。

```powershell
conda run -n JK --no-capture-output npm ci
conda run -n JK --no-capture-output npm test
conda run -n JK --no-capture-output npm run test:countdown
conda run -n JK --no-capture-output npm run build
conda run -n JK --no-capture-output npm run electron:build
```

自动化界面验证：`conda run -n JK --no-capture-output npm run test:ui`。打包后验证：`conda run -n JK --no-capture-output node tests/artifact-smoke.cjs`。测试使用独立临时用户数据目录，不覆盖日常设置；本机通过 `PLAYWRIGHT_MODULE` 可指定 Playwright 安装路径。

0.2.1 交互回归：`conda run -n JK --no-capture-output node tests/interaction-regressions.cjs`，覆盖外部点击、Esc、删除确认、连续重复抽取、同一时刻定时任务和旧结果重启兼容。

倒计时回归：`conda run -n JK --no-capture-output node tests/countdown-regressions.cjs`，覆盖实际 EXE 的倒计时表单、后台提醒弹窗、剩余时长、确认和重启持久化。

免安装主程序为 `release/v0.3.0/win-unpacked/小决定 Desktop.exe`，双击即可运行。必须连同整个目录一起移动。`electron:build` 和 `electron:pack` 均只生成免安装版本。

## 开发运行

```powershell
conda run -n JK --no-capture-output npm install
conda run -n JK --no-capture-output npm run dev
```

## 桌面开发运行

需要先安装 Rust/Cargo 和 Visual Studio Build Tools。

```powershell
npm run tauri:dev
```

## 构建 Windows 免安装版

### Electron 路线（不需要 Visual Studio Build Tools）

```powershell
conda run -n JK --no-capture-output npm run electron:build
```

如果 electron-builder 的目录打包受网络或安全软件影响，也可以使用当前已生成的免安装版：

```text
release/v0.3.0/win-unpacked/小决定 Desktop.exe
```

### Tauri 路线（需要 Rust/Cargo 和 Visual Studio Build Tools）

```powershell
npm run tauri:build
```

构建成功后，安装包会生成在：

```text
src-tauri/target/release/bundle/nsis/
```

## Windows 打包依赖

当前项目已经启用 Tauri NSIS 打包。若本机还没有 Rust 或 MSVC，可用下面命令安装：

```powershell
winget install --id Rustlang.Rustup --exact
winget install --id Microsoft.VisualStudio.2022.BuildTools --exact
```

安装 Visual Studio Build Tools 时，需要包含：

- Desktop development with C++
- MSVC v143
- Windows 10/11 SDK

安装完成后重新打开 PowerShell，再运行：

```powershell
rustc --version
cargo --version
npm run tauri:build
```
