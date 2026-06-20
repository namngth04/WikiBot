const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');

function getTargetUrl() {
  if (process.env.WIKIBOT_URL) {
    return process.env.WIKIBOT_URL;
  }

  const pathsToCheck = [
    path.join(process.cwd(), 'config.json'),
    path.join(path.dirname(process.execPath), 'config.json'),
    path.join(app.getPath('userData'), 'config.json')
  ];

  for (const configPath of pathsToCheck) {
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.server_url) {
          console.log(`[WikiBot] Loaded server_url from ${configPath}: ${config.server_url}`);
          return config.server_url;
        }
      } catch (err) {
        console.error(`[WikiBot] Error reading config at ${configPath}:`, err);
      }
    }
  }

  // Create a default config.json in userData if none exists
  const defaultPath = path.join(app.getPath('userData'), 'config.json');
  const defaultConfig = {
    server_url: 'http://localhost:3000',
    description: 'Thay doi server_url thanh dia chi IP Google Cloud VM cua ban (vi du: http://<GCP-VM-IP>)'
  };
  try {
    fs.writeFileSync(defaultPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
    console.log(`[WikiBot] Created default config.json at ${defaultPath}`);
  } catch (err) {
    console.error('[WikiBot] Cannot write default config:', err);
  }

  return defaultConfig.server_url;
}

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'WikiBot Desktop Client',
    backgroundColor: '#010102',
    icon: path.join(__dirname, 'assets/chatbot.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'electron-preload.js')
    }
  });

  const targetUrl = getTargetUrl();

  // Load the app with custom user agent to bypass DesktopGuard
  mainWindow.loadURL(targetUrl, {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Electron/WikiBot'
  });

  // Remove default menu bar
  mainWindow.removeMenu();

  // Open the DevTools in dev mode if needed
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// Ensure custom user agent is sent in all request headers
app.whenReady().then(() => {
  // Đăng ký định danh ứng dụng riêng để Windows Taskbar hiển thị chính xác biểu tượng WikiBot
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.wikibot.desktop');
  }

  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Electron/WikiBot';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
