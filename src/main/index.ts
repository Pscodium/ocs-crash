/* eslint-disable no-empty-pattern */
import { app, shell, BrowserWindow, dialog, ipcMain } from 'electron';
import path, { join } from 'path';
import fs from 'fs';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import icon from '../../resources/favicon.png?asset';

function createWindow(): void {
    const mainWindow = new BrowserWindow({
        width: 1300,
        height: 770,
        maximizable: true,
        resizable: true,
        frame: true,
        autoHideMenuBar: true,
        icon,
        webPreferences: {
            contextIsolation: true,
            navigateOnDragDrop: true,
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false,
        },
    });

    mainWindow.on('ready-to-show', () => {
        mainWindow.show();
        mainWindow.maximize();
    });

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url);
        return { action: 'deny' };
    });

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }

    ipcMain.on('window-control', ({}, action) => {
        switch (action) {
            case 'minimize':
                mainWindow.minimize();
                break;
            case 'maximize':
                if (mainWindow.isMaximized()) {
                    mainWindow.unmaximize();
                } else {
                    mainWindow.maximize();
                }
                break;
            case 'close':
                mainWindow.close();
                break;
            default:
                break;
        }
    });

    ipcMain.handle('select-audio-files', async () => {
        if (!mainWindow) return [];

        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile', 'multiSelections'],
            filters: [{ name: 'Arquivos de Áudio', extensions: ['wav', 'mp3', 'ogg'] }],
        });

        if (result.canceled) {
            return [];
        }

        // Retorna os caminhos e nomes dos arquivos selecionados
        return result.filePaths.map((filePath) => ({
            path: filePath,
            name: path.basename(filePath),
        }));
    });

    // Manipulador para ler arquivos de áudio
    ipcMain.handle('read-audio-file', async (event, filePath) => {
        try {
            const buffer = fs.readFileSync(filePath);
            return Array.from(new Uint8Array(buffer));
        } catch (error) {
            console.error('Erro ao ler arquivo de áudio:', error);
            throw error;
        }
    });
}

app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.electron');

    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window);
    });

    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
