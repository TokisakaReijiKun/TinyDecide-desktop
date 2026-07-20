# 小决定 Desktop

一个本地离线的 Windows 桌面随机决策工具，使用 Tauri v2 + React + TypeScript + Vite 构建。

## 开发运行

```powershell
npm install
npm run dev
```

## 桌面开发运行

需要先安装 Rust/Cargo 和 Visual Studio Build Tools。

```powershell
npm run tauri:dev
```

## 构建 Windows 安装包

### Electron 路线（不需要 Visual Studio Build Tools）

```powershell
npm run electron:pack
```

如果 electron-builder 的目录打包受网络或安全软件影响，也可以使用当前已生成的免安装版：

```text
release/xiaojd-electron-portable/小决定 Desktop.exe
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
