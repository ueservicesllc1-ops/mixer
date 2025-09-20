const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { createServer } = require('http');
const next = require('next');

const devApp = next({ dev: isDev });
const handle = devApp.getRequestHandler();

app.on('ready', async () => {
  await devApp.prepare();
  
  const server = createServer((req, res) => handle(req, res));

  server.listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
    
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadURL('http://localhost:3000');

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
