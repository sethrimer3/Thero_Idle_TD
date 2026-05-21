const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distIndex = path.join(rootDir, 'dist', 'index.html');
const sourceIndex = path.join(rootDir, 'index.html');

function resolveGameIndex() {
  return fs.existsSync(distIndex) ? distIndex : sourceIndex;
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#050505',
    title: 'Thero Idle TD',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(resolveGameIndex());
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
