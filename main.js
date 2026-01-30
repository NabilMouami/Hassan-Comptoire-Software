const { app, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

const { spawn, fork } = require("child_process");

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: null,
    },
  });
  mainWindow.webContents.openDevTools();

  if (app.isPackaged) {
    // Load frontend from build
    mainWindow.loadFile(path.join(__dirname, "react-build", "index.html"));
  } else {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  }
}

function startBackend() {
  const backendPath = app.isPackaged
    ? path.join(
        process.resourcesPath,
        "app.asar.unpacked",
        "backend",
        "server.js",
      )
    : path.join(__dirname, "backend", "server.js");

  console.log("Starting backend at:", backendPath);

  backendProcess = fork(backendPath, [], {
    cwd: path.dirname(backendPath),
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
    silent: false,
  });

  backendProcess.on("error", (err) => {
    console.error("❌ Backend failed:", err);
  });

  backendProcess.on("exit", (code) => {
    console.log("Backend exited with code:", code);
  });
}

function waitForBackend(url, retries = 20, delay = 500) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http
        .get(url, () => resolve())
        .on("error", () => {
          if (retries === 0) {
            reject(new Error("Backend not reachable"));
          } else {
            retries--;
            setTimeout(attempt, delay);
          }
        });
    };
    attempt();
  });
}

app.whenReady().then(async () => {
  createWindow(); // 👈 ALWAYS open window

  startBackend();

  try {
    await waitForBackend("http://127.0.0.1:5000");
    console.log("✅ Backend ready");
  } catch (err) {
    console.error("❌ Backend failed to start", err);
  }
});

app.on("before-quit", () => {
  if (backendProcess) backendProcess.kill();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
