const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

const isDev = !app.isPackaged;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1160,
    height: 760,
    minWidth: 980,
    minHeight: 620,
    title: "小决定 Desktop",
    backgroundColor: "#eef2f6",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  Menu.setApplicationMenu(null);

  if (isDev) {
    mainWindow.loadURL("http://127.0.0.1:1420");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
