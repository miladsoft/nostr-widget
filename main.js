const { app, BrowserWindow, Tray, Menu, screen } = require('electron');
const path = require('path');

let tray = null;
let win = null;

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    
    win = new BrowserWindow({
        width: 390,
        height: 780,
        transparent: true,
        frame: false,
        resizable: false,
        skipTaskbar: true,
        x: width - 410,
        y: height - 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // Required for nostr-tools
            webSecurity: true,
            enableRemoteModule: false,
            worldSafeExecuteJavaScript: true,
            allowRunningInsecureContent: false,
            contentSecurityPolicy: "default-src 'self'; connect-src 'self' wss://*; style-src 'self' https: 'unsafe-inline'; script-src 'self' 'unsafe-eval' https:;"
        },
        hasShadow: true,
        roundedCorners: true,
        backgroundColor: '#00000000'
    });

    // Update CSP header with all required directives
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self' https:; " +
                    "connect-src 'self' wss://* https://*; " +
                    "style-src 'self' 'unsafe-inline' https://*; " +
                    "script-src 'self' 'unsafe-inline' https://*; " +
                    "font-src 'self' https://* data:; " +
                    "img-src 'self' https://* data:;"
                ]
            }
        });
    });

    win.loadFile('index.html');
    win.setAlwaysOnTop(true);
    win.webContents.openDevTools({ mode: 'detach' }); // For debugging
}

function createTray() {
    tray = new Tray(path.join(__dirname, 'icon.png'));
    
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show Widget', click: () => win.show() },
        { label: 'Hide Widget', click: () => win.hide() },
        { type: 'separator' },
        { label: 'Exit', click: () => app.quit() }
    ]);
    
    tray.setToolTip('Nostr Widget');
    tray.setContextMenu(contextMenu);

    // Add click handler here instead of 'ready' event
    tray.on('click', () => {
        if (win) {
            win.isVisible() ? win.hide() : win.show();
        }
    });
}

app.whenReady().then(() => {
    createWindow();
    createTray();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
