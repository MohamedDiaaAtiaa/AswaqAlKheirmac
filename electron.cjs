const { app, BrowserWindow, Menu } = require('electron')

const template = [
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectall' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forcereload' },
      { role: 'toggledevtools' },
      { type: 'separator' },
      { role: 'resetzoom' },
      { role: 'zoomin' },
      { role: 'zoomout' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

const path = require('path')

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "أسواق الخير - لوحة التحكم",
    icon: path.join(__dirname, 'build/icon.png'),
    webPreferences: {
      nodeIntegration: true
    }
  })

  // In production, load the built index.html
  // In development, you would load the localhost Vite server output
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, 'dist/index.html'))
  } else {
    // If you are running 'npm run dev', it usually runs on 5173
    win.loadURL('http://localhost:5173')
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
