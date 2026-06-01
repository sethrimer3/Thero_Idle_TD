const { app, BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distIndex = path.join(rootDir, 'dist', 'index.html');
const sourceIndex = path.join(rootDir, 'index.html');
const appIconPath = path.join(rootDir, 'assets', 'icon', 'Thero_icon.ico');

function resolveGameIndex() {
  return fs.existsSync(distIndex) ? distIndex : sourceIndex;
}

function buildContentSecurityPolicy(isDevelopment) {
  const commonDirectives = [
    "default-src 'self' file:",
    "script-src 'self' 'unsafe-inline' file: https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' file: https://fonts.googleapis.com",
    "img-src 'self' data: blob: file:",
    "media-src 'self' data: blob: file:",
    "font-src 'self' data: file: https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "worker-src 'self' blob: file:",
    "child-src 'self' blob: file:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ];

  if (isDevelopment) {
    commonDirectives.push(
      "connect-src 'self' file: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
    );
  } else {
    commonDirectives.push("connect-src 'self' file:");
  }

  return commonDirectives.join('; ');
}

function installElectronContentSecurityPolicy() {
  const isDevelopment = !app.isPackaged;
  const contentSecurityPolicy = buildContentSecurityPolicy(isDevelopment);

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [contentSecurityPolicy],
      },
    });
  });
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 960,
    minHeight: 540,
    icon: appIconPath,
    backgroundColor: '#050505',
    title: 'Thero Idle TD',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    },
  });

  mainWindow.loadFile(resolveGameIndex());
}

app.whenReady().then(() => {
  installElectronContentSecurityPolicy();
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
