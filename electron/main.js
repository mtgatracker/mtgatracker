const console = require('console');

global.updateReady = false
const { handleStartupEvent } = require("./updates")

if (handleStartupEvent()) {
  return;
}

const { app, ipcMain, BrowserWindow, autoUpdater } = require('electron')
const fs = require('fs');
const path = require('path')

let firstRun = process.argv[1] == '--squirrel-firstrun';

if (!firstRun && fs.existsSync(path.resolve(path.dirname(process.execPath), '..', 'update.exe'))) {
  autoUpdater.checkForUpdates()
}

const findProcess = require('find-process');
const settings = require('electron-settings');
autoUpdater.on('update-downloaded', (e) => {
  global.updateReady = true
  mainWindow.webContents.send('updateReadyToInstall', {
    text: "A new version has been downloaded. Restart to update!"
  })
})


/*************************************************************
 * py process
 *************************************************************/

const PY_DIST_FOLDER = 'appdist'
const PY_FOLDER = 'app'
const PY_MODULE = 'mtgatracker_backend' // without .py suffix

let pyProc = null
let pyPort = null

let getBooleanArg = (short, long) => {
  let shortIdx = process.argv.indexOf(short)
  let longIdx = process.argv.indexOf(long)
  return shortIdx != -1 || longIdx != -1;
}

let debugCmdOpt = getBooleanArg('-d', '--debug')
let frameCmdOpt = getBooleanArg('-uf', '--framed')

if (debugCmdOpt) {
  settings.set('debug', true)
}
if (frameCmdOpt) {
  settings.set('useFrame', true)
}

let debug = settings.get('debug', false);
let showErrors = settings.get('showErrors', false);
let incognito = settings.get('incognito', false);
let showInspector = settings.get('showInspector', true);
let useFrame = settings.get('useFrame', false);
let useTheme = settings.get('useTheme', false);
let themeFile = settings.get('themeFile', "");
let showIIDs = settings.get('showIIDs', false);
let no_server = settings.get('no_server', false);
let mouseEvents = settings.get('mouseEvents', true);
let leftMouseEvents = settings.get('leftMouseEvents', true);
let kill_server = settings.get('kill_server', false);
let winLossCounter = settings.get('winLossCounter', {win: 0, loss: 0});
let showWinLossCounter = settings.get('showWinLossCounter', true);

let runFromSource = !process.execPath.endsWith("MTGATracker.exe")

let noFollow = false;
let server_killed = false;
let readFullFile = false;
let debugFile = false;


ipcMain.on('messageAcknowledged', (event, arg) => {
  let acked = settings.get("messagesAcknowledged", [])
  acked.push(arg)
  settings.set("messagesAcknowledged", acked)
  global["messagesAcknowledged"] = acked;
})

ipcMain.on('settingsChanged', (event, arg) => {
  global[arg.key] = arg.value;
  settings.set(arg.key, arg.value)
  mainWindow.webContents.send('settingsChanged')
})

let openSettingsWindow = () => {
  if(settingsWindow == null) {
    settingsWindow = new BrowserWindow({width: 800,
                                        height: 800,
                                        toolbar: false,
                                        titlebar: false,
                                        title: false,
                                        maximizable: false,
                                        show: false,
                                        icon: "img/icon_small.ico"})
    settingsWindow.setMenu(null)
    settingsWindow.loadURL(require('url').format({
      pathname: path.join(__dirname, 'settings.html'),
      protocol: 'file:',
      slashes: true
    }))
    if (debug) {
      settingsWindow.webContents.openDevTools()
    }
    settingsWindow.on('closed', function () {
      settingsWindow = null;
    })
  }
  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show()
  })
}

ipcMain.on('openSettings', openSettingsWindow)

app.disableHardwareAcceleration()

const guessPackaged = () => {
  const fullPath = path.join(__dirname, "..", PY_DIST_FOLDER)
  return fs.existsSync(fullPath)
}

const getScriptPath = () => {
  if (!guessPackaged()) {
    return path.join(__dirname, "..", PY_FOLDER, PY_MODULE + '.py')
  }
  if (process.platform === 'win32') {
    return path.join(__dirname, "..", PY_DIST_FOLDER, PY_MODULE, PY_MODULE + '.exe') // TODO: verify this
  }
  return path.join(__dirname, "..", PY_DIST_FOLDER, PY_MODULE, PY_MODULE)
}

const getPyBinPath = () => {
  if (process.platform === 'win32') {
    venv_path_win = path.join(__dirname, "..", "venv", "Scripts", "python.exe")
    venv_path_x = path.join(__dirname, "..", "venv", "Scripts", "python")
    fallback_path = "python"
    if (fs.existsSync(venv_path_win)) {
        return venv_path_win + " -u"
    } else if (fs.existsSync(venv_path_x)) {
        return venv_path_x + " -u"
    } else {
        return fallback_path + " -u" // ? shrug
    }
  }
}

const getLogFilePath = () => {
    // TODO: make this cmd-line configurable
    return path.join(__dirname, "..", "app", "example_logs", "kld", "output_log.txt")
}

const selectPort = () => {
  pyPort = 8089
  return pyPort
}

port = selectPort()
logPath = getLogFilePath()

const generateArgs = () => {
    var args = ["-p", port]
    if (debugFile) {
        args.push("-i")
        args.push(logPath)
    }
    if (noFollow) {
        args.push('-nf')
    }
    if (readFullFile) {
        args.push('-f')
    }
    if (mouseEvents) {
      args.push('-m')
    }
    return args
}

const cleanupPyProc = (cb)  => {
    finishedCount = 0;
    p1 = findProcess('name', "mtgatracker_backend.exe")
    p2 = findProcess('port', 5678)
    Promise.all([p1, p2]).then(function(vals) {
        nameList = vals[0]
        portList = vals[1]
        killedList = []
        nameList.forEach(function(proc) {
            if (proc.pid != 0 && !killedList.includes(proc.pid)) {
                console.log("leftover python process (name) @ " + proc.pid + ", killing...")
                process.kill(proc.pid)
                killedList.push(proc.pid)
            }
        })
        portList.forEach(function(proc) {
            if (proc.pid != 0 && !killedList.includes(proc.pid)) {
                console.log("leftover python process (port) @ " + proc.pid + ", killing...")
                process.kill(proc.pid)
                killedList.push(proc.pid)
            }
        })
      cb()
    })

}

const createPyProc = () => {
  let script = getScriptPath()

  if (guessPackaged()) {
    pyProc = require('child_process').execFile(script, generateArgs())
  } else {
    pyProc = require('child_process').spawn(getPyBinPath(), [script].concat(generateArgs()), {shell: true})
  }

  if (pyProc != null) {
    console.log('child process success on port ' + port)
    pyProc.stderr.on('data', function(data) {
      console.log("err: " + data.toString());
    });
    pyProc.stdout.on('data', function(data) {
      console.log("out:" + data.toString());
    });
    pyProc.on('exit', function(code) {
      console.log(`python exited with code ${code}`);
      server_killed = true;
    });
  }
}

if (!no_server) {
    cleanupPyProc(createPyProc)
}

global.debug = debug;
global.showErrors = showErrors;
global.incognito = incognito;
global.showInspector = showInspector;
global.useFrame = useFrame;
global.useTheme = useTheme;
global.themeFile = themeFile;
global.showIIDs = showIIDs;
global.leftMouseEvents = leftMouseEvents;
global.mouseEvents = mouseEvents;
global.winLossCounter = winLossCounter;
global.showWinLossCounter = showWinLossCounter;
global.version = app.getVersion()
global.messagesAcknowledged = settings.get("messagesAcknowledged", [])
global.runFromSource = runFromSource

/*************************************************************
 * window management
 *************************************************************/

let mainWindow = null
let settingsWindow = null

let window_width = 354;
let window_height = 200;
if (debug) {
    window_width = 1220;
    window_height = 700;
}

const createWindow = () => {
  mainWindow = new BrowserWindow({width: window_width,
                                  height: window_height,
                                  show: false,
                                  transparent: !(debug || useFrame),
                                  resizable: (debug || useFrame),
                                  frame: (debug || useFrame),
                                  alwaysOnTop: true,
                                  toolbar: false,
                                  titlebar: false,
                                  title: false,
                                  maximizable: false,
                                  icon: "img/icon_small.ico"})
  mainWindow.loadURL(require('url').format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))
  mainWindow.on('closed', () => {
    console.log("main window closed")
    killServer()
  })

  if (debug) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.webContents.send('settingsChanged')
    mainWindow.show()
    console.timeEnd('init')
    mainWindow.webContents.setZoomFactor(0.8)
  })

  let versionsAcknowledged = settings.get('versionsAcknowledged', [])

  // show release notes on first launch of new version
  if (!versionsAcknowledged.includes(app.getVersion())) {
    versionsAcknowledged.push(app.getVersion())
    settings.set("versionsAcknowledged", versionsAcknowledged)
    openSettingsWindow()
  }
}

function freeze(time) {
    const stop = new Date().getTime() + time;
    while(new Date().getTime() < stop);
}

const killServer = () => {
    console.log("killServer called")
    if (!server_killed && kill_server) {
        server_killed = true;
        if (!no_server) {
            freeze(2000)
            cleanupPyProc(() => {})
        }
        pyProc = null
        pyPort = null
    }
//    if (settingsWindow) {
//      settingsWindow.close()
//      settingsWindow = null;
//    }
    if (global.updateReady) {
      console.log("doing quitAndInstall")
      autoUpdater.quitAndInstall()
    } else {
      console.log("app.quit()")
      app.quit()
    }
}

app.on('ready', createWindow)

app.on('will-quit', function() {
  console.log("will quit")
  killServer()
})
