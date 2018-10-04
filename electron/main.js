const console = require('console');
const jwt = require('jsonwebtoken');

global.updateReady = false
global.updateDownloading = false
global.checkInProgress = false
const { handleStartupEvent, updater } = require("./updates")

if (handleStartupEvent()) {
  return;
}

const { app, ipcMain, BrowserWindow } = require('electron')
const fs = require('fs');
const path = require('path')
const keytar = require('keytar')
const uuidv4 = require('uuid/v4');
const request = require('request')
const crypto = require("crypto")

let checksum = (str, algorithm, encoding) => {
    return crypto
        .createHash(algorithm || 'md5')
        .update(str, 'utf8')
        .digest(encoding || 'hex')
}

const API_URL = "https://gx3.mtgatracker.com/str-85b6a06b2d213fac515a8ba7b582387a-p3/mtgatracker-prod-EhDvLyq7PNb";

// check if we have saved a UUID for this tracker. If not, generate one
keytar.getPassword("mtgatracker", "tracker-id").then(savedTrackerID => {
  let uuidIsNew = false;
  if (!savedTrackerID) {
    // we need to make one
    let trackerID = uuidv4() + "_" + crypto.randomBytes(10).toString('hex');
    keytar.setPassword("mtgatracker", "tracker-id", trackerID)
    uuidIsNew = true;
    global.trackerID = trackerID;
  } else {
    global.trackerID = savedTrackerID;
  }

  // now we check if we have a token with that uuid
  keytar.getPassword("mtgatracker", "tracker-id-token").then(token => {
    var decodedTrackerIdToken
    if (token !== null) {
      decodedTrackerIdToken = jwt.decode(token)
    }
    if (!token || uuidIsNew || decodedTrackerIdToken.trackerID !== global.trackerID) {
      // we need to get a token and save it
      request.post({
        url: `${API_URL}/public-api/tracker-token/`,
        json: true,
        body: {trackerID: global.trackerID},
        headers: {'User-Agent': 'MTGATracker-App'}
      }, (err, res, data) => {
        if (err) console.log(err)
        if(res && res.statusCode == 200) {
          keytar.setPassword("mtgatracker", "tracker-id-token", data.token)
        } else {
          console.log(`unknown status code while getting tracker-token: ${res.statusCode}`)
        }
      })
    }
  })
})

const firstRun = process.argv[1] == '--squirrel-firstrun';
global.firstRun = firstRun
const runFromSource = !process.execPath.endsWith("MTGATracker.exe")

if (!firstRun && fs.existsSync(path.resolve(path.dirname(process.execPath), '..', 'update.exe'))) {
  setInterval(() => {
    if (!global.updateDownloading && !global.checkInProgress) {
      global.checkInProgress = true
      updater.check((err, status) => {
        if (!err && status) {
          // Download the update
          global.updateDownloading = true;
          updater.download()
        }
        // the check is complete, we can run the check again now
        global.checkInProgress = false
      })
    }
  }, 10000)
}

const findProcess = require('find-process');
const settings = require('electron-settings');
updater.autoUpdater.on('update-downloaded', (e) => {
  global.updateReady = true
  mainWindow.webContents.send('updateReadyToInstall', {
    text: "A new version has been downloaded. Restart to update!"
  })
})

if (!firstRun && fs.existsSync(path.resolve(path.dirname(process.execPath), '..', 'update.exe'))) {
  setInterval(() => {
    if (!global.updateDownloading) {
      updater.check((err, status) => {
        if (!err && status) {
          // Download the update
          updater.download()
          global.updateDownloading = true;
        }
      })
    }
  }, 1000)
}


// adapted from the excellent medium post:
// https://medium.com/@hql287/persisting-windows-state-in-electron-using-javascript-closure-17fc0821d37
function windowStateKeeper(windowName) {
  let window, windowState;
  function setBounds() {
    // Restore from settings
    if (settings.has(`windowState.${windowName}`)) {

      windowState = settings.get(`windowState.${windowName}`);
      // we also need to check if the screen x and y would end up on is available, if not fix it
      // app is ready at this point, we can use screen
      const { screen } = require("electron")

      let positionIsValid = false;
      for (let display of screen.getAllDisplays()) {
        let lowestX = display.bounds.x;
        let highestX = lowestX + display.bounds.width;

        let lowestY = display.bounds.y;
        let highestY = lowestY + display.bounds.height;
        if (lowestX < windowState.x && windowState.x < highestX && lowestY < windowState.y && windowState.y < highestY) {
          positionIsValid = true;
        }
      }
      if (!positionIsValid) {
        console.log(`windowState ${windowState.x} / ${windowState.y} is not valid, resetting to (10, 10)`)
        windowState.x = 10
        windowState.y = 10
      }
      return;
    }
    // Default
    windowState = {
      x: undefined,
      y: undefined,
      width: 1000,
      height: 800,
    };
  }
  function saveState() {
    if(window) {
      if (!windowState.isMaximized) {
        windowState = window.getBounds();
      }
      windowState.isMaximized = window.isMaximized();
      settings.set(`windowState.${windowName}`, windowState);
    }
  }
  function track(win) {
    window = win;
    win.on('close', saveState);
  }
  setBounds();
  return({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    isMaximized: windowState.isMaximized,
    track,
  });
}


// check if we need to show the ToS
let tosAcks = settings.get("tosAcks", [])
let tosPath = 'resources/app.asar/legal/tos.md';
if (runFromSource) {
  tosPath = 'legal/tos.md';
}

let currentTOSChecksum = checksum(fs.readFileSync(tosPath))

let tosAcked = false;

if (tosAcks.includes(currentTOSChecksum)) {
   tosAcked = true;
   console.log("TOS already acked, ok to launch")
} else {
   console.log("must ack TOS before launch")
}

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

let debugFileCmdOpt = getBooleanArg('-df', '--debug_file')
let debugCmdOpt = getBooleanArg('-d', '--debug')
let frameCmdOpt = getBooleanArg('-uf', '--use_framed')
let fullFileCmdOpt = getBooleanArg('-f', '--full_file')

if (debugCmdOpt) {
  settings.set('debug', true)
}

let debugFile = false;
if (debugFileCmdOpt) {
    debugFile = true;
    console.log("Using debug file")
}

if (frameCmdOpt) {
  settings.set('useFrame', true)
}

let debug = settings.get('debug', false);
let mtgaOverlayOnly = settings.get('mtgaOverlayOnly', true);
let showErrors = settings.get('showErrors', false);
let incognito = settings.get('incognito', false);
let showInspector = settings.get('showInspector', true);
let useFrame = settings.get('useFrame', false);
let staticMode = settings.get('staticMode', false);
let useTheme = settings.get('useTheme', false);
let themeFile = settings.get('themeFile', "");
let showIIDs = settings.get('showIIDs', false);
let no_server = settings.get('no_server', false);
let mouseEvents = settings.get('mouseEvents', true);
let leftMouseEvents = settings.get('leftMouseEvents', true);
let showGameTimer = settings.get('showGameTimer', true);
let showChessTimers = settings.get('showChessTimers', true);
let hideDelay = settings.get('hideDelay', 10);
let invertHideMode = settings.get('invertHideMode', false);
let winLossCounter = settings.get('winLossCounter', {win: 0, loss: 0});
let showWinLossCounter = settings.get('showWinLossCounter', true);
let showVaultProgress = settings.get('showVaultProgress', true);
let lastCollection = settings.get('lastCollection', {});
let lastVaultProgress = settings.get('lastVaultProgress', 0);
let minVaultProgress = settings.get('minVaultProgress', 0);
let sortMethod = settings.get('sortMethod', 'draw');
let useFlat = settings.get('useFlat', true);
let useMinimal = settings.get('useMinimal', true);
let zoom = settings.get('zoom', 0.8);


let kill_server = true;
let noFollow = false;
let server_killed = false;
let readFullFile = false;
if (fullFileCmdOpt) {
  readFullFile = true;
}

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

ipcMain.on('tosAgreed', (event, arg) => {
  let tosAcks = settings.get("tosAcks", [])
  let currentTOSChecksum = checksum(fs.readFileSync(tosPath))
  if (!tosAcks.includes(currentTOSChecksum)) {
    tosAcks.push(currentTOSChecksum)
  }
  settings.set('tosAcks', tosAcks)
  createMainWindow()
  tosWindow.close()
})

let openSettingsWindow = () => {
  if(settingsWindow == null) {
    let settingsWidth = debug ? 1400 : 800;

    const settingsWindowStateMgr = windowStateKeeper('settings')
    settingsWindow = new BrowserWindow({width: settingsWidth,
                                        height: 800,
                                        toolbar: false,
                                        titlebar: false,
                                        title: false,
                                        maximizable: false,
                                        show: false,
                                        icon: "img/icon_small.ico",
                                        x: settingsWindowStateMgr.x,
                                        y: settingsWindowStateMgr.y})
    settingsWindowStateMgr.track(settingsWindow)
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

let openTOSWindow = () => {
  if(tosWindow == null) {
    tosWindow  = new BrowserWindow({width: 800,
                                        height: 560,
                                        toolbar: false,
                                        titlebar: false,
                                        title: false,
                                        maximizable: false,
                                        show: false,
                                        icon: "img/icon_small.ico"})
    tosWindow.setMenu(null)
    tosWindow.loadURL(require('url').format({
      pathname: path.join(__dirname, 'tos.html'),
      protocol: 'file:',
      slashes: true
    }))
    if (debug) {
      tosWindow.webContents.openDevTools()
    }
    tosWindow.on('closed', function () {
      tosWindow = null;
    })
  }
  tosWindow.once('ready-to-show', () => {
    tosWindow.show()
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
    pyProc = require('child_process').spawn(script, generateArgs())
  } else {
    pyProc = require('child_process').spawn(getPyBinPath(), [script].concat(generateArgs()), {shell: true})
  }

  if (pyProc != null) {
    console.log('child process success on port ' + port)
    pyProc.stderr.on('data', function(data) {
      console.log("py stderr: " + data.toString());
      if (mainWindow) {
        mainWindow.webContents.send('stdout', {text: "py stderr:" + data.toString()})
      }
    });
    pyProc.stdout.on('data', function(data) {
      console.log("py stdout:" + data.toString());
      if (mainWindow) {
        mainWindow.webContents.send('stdout', {text: "py stdout:" + data.toString()})
      }
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

global.API_URL = API_URL;
global.debug = debug;
global.mtgaOverlayOnly = mtgaOverlayOnly;
global.showErrors = showErrors;
global.incognito = incognito;
global.showInspector = showInspector;
global.useFrame = useFrame;
global.staticMode = staticMode;
global.useTheme = useTheme;
global.themeFile = themeFile;
global.showIIDs = showIIDs;
global.leftMouseEvents = leftMouseEvents;
global.showGameTimer = showGameTimer;
global.showChessTimers = showChessTimers;
global.invertHideMode = invertHideMode;
global.hideDelay = hideDelay;
global.mouseEvents = mouseEvents;
global.winLossCounter = winLossCounter;
global.showWinLossCounter = showWinLossCounter;
global.showVaultProgress = showVaultProgress;
global.lastVaultProgress = lastVaultProgress;
global.lastCollection = lastCollection;
global.minVaultProgress = minVaultProgress;
global.version = app.getVersion()
global.messagesAcknowledged = settings.get("messagesAcknowledged", [])
global.runFromSource = runFromSource
global.sortMethod = sortMethod
global.useFlat = useFlat
global.useMinimal = useMinimal
global.zoom = zoom

/*************************************************************
 * window management
 *************************************************************/

let mainWindow = null
let settingsWindow = null
let tosWindow = null

let window_width = 354;
let window_height = 200;
if (debug) {
    window_width = 1220;
    window_height = 700;
}

const createMainWindow = () => {
  const mainWindowStateMgr = windowStateKeeper('main')
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
                                  icon: "img/icon_small.ico",
                                  x: mainWindowStateMgr.x,
                                  y: mainWindowStateMgr.y})
  mainWindowStateMgr.track(mainWindow)
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
    mainWindow.webContents.setZoomFactor(zoom)
  })

  let versionsAcknowledged = settings.get('versionsAcknowledged', [])

  // show release notes on first launch of new version
  if (!versionsAcknowledged.includes(app.getVersion())) {
    versionsAcknowledged.push(app.getVersion())
    settings.set("versionsAcknowledged", versionsAcknowledged)
    openSettingsWindow()
  }
}

const openFirstWindow = () => {
  if (tosAcked) {
    createMainWindow()
  } else {
    openTOSWindow()
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
            console.log("cleaning up")
            freeze(2000)
            cleanupPyProc(() => {})
        }
        pyProc = null
        pyPort = null
    }
    if (global.updateReady) {
      console.log("doing quitAndInstall")
      updater.install()
    } else {
      console.log("app.quit()")
      app.quit()
    }
}

app.on('ready', openFirstWindow)

app.on('will-quit', function() {
  console.log("will quit")
  killServer()
})
