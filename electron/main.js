const console = require('console');
const jwt = require('jsonwebtoken');
const { inspectorRouter } = require("./inspectorApi")

global.updateReady = false
global.updateDownloading = false
global.checkInProgress = false
const { handleStartupEvent, updater } = require("./updates")

if (handleStartupEvent()) {
  return;
}

const { app, ipcMain, BrowserWindow, Tray, Menu, nativeImage } = require('electron')
const fs = require('fs');
const path = require('path')
const keytar = require('keytar')
const uuidv4 = require('uuid/v4');
const request = require('request')
const crypto = require("crypto")

// Check if our instance is the primary instance
if(app.makeSingleInstance(focusMTGATracker)) {
  app.quit();
  return;
}

let checksum = (str, algorithm, encoding) => {
    return crypto
        .createHash(algorithm || 'md5')
        .update(str, 'utf8')
        .digest(encoding || 'hex')
}

const API_URL = "https://gxt.mtgatracker.com/str-85b6a06b2d213fac515a8ba7b582387a-pt/mtgatracker-prod-EhDvLyq7PNb";

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

function updateCheck() {
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
}

if (!firstRun && fs.existsSync(path.resolve(path.dirname(process.execPath), '..', 'update.exe'))) {
  updateCheck() // check once; setInterval fires the first time AFTER the timeout
  setInterval(updateCheck,    1000     * 60       * 60     * 2)
                          //  1 second * 1 minute * 1 hour * 2 = 2 hours
}

const findProcess = require('find-process');
const settings = require('electron-settings');
updater.autoUpdater.on('update-downloaded', (e) => {
  global.updateReady = true
  mainWindow.webContents.send('updateReadyToInstall', {
    text: "A new version has been downloaded. Restart to update!"
  })
})

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

let appDataRoaming = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + 'Library/Preferences' : '/var/local')
let logPath = path.join(appDataRoaming, "..", "LocalLow", "Wizards Of The Coast", "MTGA", "output_log.txt");


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

if (frameCmdOpt) {
  settings.set('useFrame', true)
}

// Hack to update to new structure
if (!settings.has('winLossCounter.alltime.total') && settings.has('winLossCounter.win') && settings.has('winLossCounter.loss')) {
  settings.set('winLossCounter.alltime.total', settings.get('winLossCounter'));
}

let debug = settings.get('debug', false);
let mtgaOverlayOnly = settings.get('mtgaOverlayOnly', true);
let showErrors = settings.get('showErrors', false);
let sendAnonymousUsageInfo = settings.get('sendAnonymousUsageInfo', false);
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
let rollupMode = settings.get('rollupMode', true);
let winLossCounter = settings.get('winLossCounter', {alltime:{total: {win: 0, loss: 0}}});
winLossCounter.daily = {total: {win: 0, loss: 0}};
let showTotalWinLossCounter = settings.get('showTotalWinLossCounter', true);
let showDeckWinLossCounter = settings.get('showDeckWinLossCounter', true);
let showDailyTotalWinLossCounter = settings.get('showDailyTotalWinLossCounter', true);
let showDailyDeckWinLossCounter = settings.get('showDailyDeckWinLossCounter', true);
let showVaultProgress = settings.get('showVaultProgress', true);
let lastCollection = settings.get('lastCollection', {});
let lastVaultProgress = settings.get('lastVaultProgress', 0);
let minVaultProgress = settings.get('minVaultProgress', 0);
let sortMethod = settings.get('sortMethod', 'draw');
let useFlat = settings.get('useFlat', true);
let useMinimal = settings.get('useMinimal', true);
let zoom = settings.get('zoom', 0.8);
let recentCards = settings.get('recentCards', []);
let recentCardsQuantityToShow = settings.get('recentCardsQuantityToShow', 10);
let minToTray = settings.get('minToTray', false);
logPath = settings.get("logPath", logPath)
let showUIButtons = settings.get('showUIButtons',true)
let showHideButton = settings.get('showHideButton',true)
let showMenu = settings.get('showMenu',true)
let blankInventory = {
                        wcCommon: 0,
                        wcUncommon: 0,
                        wcRare: 0,
                        wcMythic: 0,
                        boosters: [],
                        draftTokens: 0,
                        gems: 0,
                        gold: 0,
                        vaultProgress: 0,
                        wcTrackPosition: 0,
                        boosters: [
                          {collationId: 100005, count: 0},
                          {collationId: 100006, count: 0},
                          {collationId: 100007, count: 0},
                          {collationId: 100008, count: 0},
                          {collationId: 100009, count: 0},
                          {collationId: 100010, count: 0},
                        ]
                      }
let inventory = settings.get('inventory',blankInventory)

let inventorySpent = JSON.parse(JSON.stringify(blankInventory))
let inventoryGained = JSON.parse(JSON.stringify(blankInventory))
let blankBoosters = {100005: 0,100006: 0,100007: 0,100008: 0,100009: 0,100010: 0}
inventorySpent.boosters = JSON.parse(JSON.stringify(blankBoosters))
inventoryGained.boosters = JSON.parse(JSON.stringify(blankBoosters))

global.historyEvents = []

let debugFile = false;
if (debugFileCmdOpt) {
    debugFile = true;
    logPath = debugFileCmdOpt;
    console.log("Using debug file")
}

let kill_server = true;
let noFollow = false;
let server_killed = false;
let readFullFile = false;
if (fullFileCmdOpt) {
  readFullFile = true;
}

ipcMain.on('updateWinLossCounters', (e,arg) => {
  if (arg.key == 'all'){
    global['winLossCounter'] = arg.value;
    settings.set('winLossCounter', arg.value);
  } else {
    global['winLossCounter']['alltime'][arg.key] = arg.value.alltime;
    global['winLossCounter']['daily'][arg.key] = arg.value.daily;
    settings.set('winLossCounter.alltime.' + arg.key, arg.value.alltime);
  }

  try {
    mainWindow.webContents.send('counterChanged',global['winLossCounter'],arg);
    if ( settingsWindow != null){
      settingsWindow.webContents.send('counterChanged',global['winLossCounter']);
    }
  } catch (e) {
    console.log("could not send counterChanged message");
    console.log(e);
  }
})

ipcMain.on('lastVaultProgressChanged', (e,new_progress) => {
  global.lastVaultProgress = new_progress
  settings.set('lastVaultProgress',new_progress)
  try {
    if ( collectionWindow != null){
      collectionWindow.webContents.send('lastVaultProgressChanged',global['lastVaultProgress']);
    }
  } catch (e) {
    console.log("could not send lastVaultProgressChanged message");
    console.log(e);
  }
})

ipcMain.on('inventoryChanged', (e,new_inventory) => {
  let fields = ['gold','gems','wcCommon','wcUncommon','wcRare','wcMythic']
  for (let field of fields) {
    let changed = new_inventory[field] - global.inventory[field]
    if (changed > 0){
      global.inventoryGained[field] += changed
    } else {
      global.inventorySpent[field] -= changed
    }
  }

  for (let new_set of new_inventory.boosters){
    let old_set = global.inventory.boosters.find(x => x.collationId == new_set.collationId) || null
    let changed = 0
    if (old_set == null){
      changed = new_set.count
      global.inventoryGained.boosters[new_set.collationId] = 0
      global.inventorySpent.boosters[new_set.collationId] = 0
    } else {
      changed = new_set.count - old_set.count
    }
    if (changed > 0){
      global.inventoryGained.boosters[new_set.collationId] += changed
    } else {
      global.inventorySpent.boosters[new_set.collationId] -= changed
    }
  }

  global.inventory = new_inventory
  settings.set('inventory',new_inventory)

  try {
    if ( collectionWindow != null){
      collectionWindow.webContents.send('inventoryChanged',global.inventory,global.inventorySpent,global.inventoryGained);
    }
  } catch (e) {
    console.log("could not send inventoryChanged message");
    console.log(e);
  }
})

ipcMain.on('recentCardsChanged', (e,new_recent) => {
  global.recentCards.unshift(new_recent)
  settings.set('recentCards',global.recentCards)
  try {
    if ( collectionWindow != null){
      collectionWindow.webContents.send('recentCardsChanged',new_recent);
    }
  } catch (e) {
    console.log("could not send recentCardsChanged message");
    console.log(e);
  }
})

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

ipcMain.on('hideRequest', (event, arg) => {
  if (historyWindow) {
    try {
      historyWindow.webContents.send('hideRequest', arg)
    } catch (error) {
      console.log("couldn't send stdout message to history window, likely already destroyed")
    }
  }
})

ipcMain.on('clearGameHistory', event => {
  global.historyEvents = []
  if (historyWindow) {
    try {
      historyWindow.webContents.send("clearGameHistory")
    } catch (error) {
      console.log("couldn't send stdout message to history window, likely already destroyed")
    }
  }
})

ipcMain.on('gameHistoryEvent', (event, arg) => {
  global.historyEvents.push(arg)
  if (historyWindow) {
    try {
      historyWindow.webContents.send('gameHistoryEventSend', arg)
    } catch (error) {
      console.log("couldn't send stdout message to main window, likely already destroyed")
    }
  }
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
    let settingsWidth = debug ? 1400 : 1025;

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
  settingsWindow.on('close', () => {global.settingsPaneIndex = 'general'})
}

let openCollectionWindow = () => {
  if(collectionWindow == null) {
    let collectionWidth = debug ? 1400 : 1025;

    const collectionWindowStateMgr = windowStateKeeper('collection')
    collectionWindow = new BrowserWindow({width: collectionWidth,
                                        height: 850,
                                        toolbar: false,
                                        titlebar: false,
                                        title: false,
                                        maximizable: false,
                                        show: false,
                                        icon: "img/icon_small.ico",
                                        x: collectionWindowStateMgr.x,
                                        y: collectionWindowStateMgr.y})
    collectionWindowStateMgr.track(collectionWindow)
    collectionWindow.setMenu(null)
    collectionWindow.loadURL(require('url').format({
      pathname: path.join(__dirname, 'collection.html'),
      protocol: 'file:',
      slashes: true
    }))
    if (debug) {
      collectionWindow.webContents.openDevTools()
    }
    collectionWindow.on('closed', function () {
      collectionWindow = null;
    })
  }
  collectionWindow.once('ready-to-show', () => {
    collectionWindow.show()
  })
}

let openInspectorWindow = () => {
  if(inspectorWindow == null) {
    let settingsWidth = debug ? 1400 : 1100;

    const inspectorWindowStateMgr = windowStateKeeper('settings')
    inspectorWindow = new BrowserWindow({width: settingsWidth,
                                        height: 800,
                                        toolbar: false,
                                        titlebar: false,
                                        title: false,
                                        show: false,
                                        icon: "img/icon_small.ico",
                                        x: inspectorWindowStateMgr.x,
                                        y: inspectorWindowStateMgr.y})
    inspectorWindowStateMgr.track(inspectorWindow)
    inspectorWindow.setMenu(null)
    inspectorWindow.loadURL(require('url').format({
      pathname: path.join(__dirname, 'inspector/index.html'),
      protocol: 'file:',
      slashes: true
    }))
    if (debug) {
      inspectorWindow.webContents.openDevTools()
    }
    inspectorWindow.on('closed', function () {
      inspectorWindow = null;
    })
  }
  inspectorWindow.once('ready-to-show', () => {
    inspectorWindow.show()
  })
  inspectorWindow.on('close', () => {global.settingsPaneIndex = 'general'})
}



let openHistoryWindow = () => {
  if(historyWindow == null) {
    let historyWidth = debug ? 1200 : 400;

    const historyWindowStateMgr = windowStateKeeper('history')
    historyWindow = new BrowserWindow({width: historyWidth,
                                        height: 800,
                                        toolbar: false,
                                        titlebar: false,
                                        title: false,
                                        maximizable: false,
                                        show: false,
                                        transparent: !(debug || useFrame),
                                        frame: (debug || useFrame),
                                        alwaysOnTop: true,
                                        icon: "img/icon_small.ico",
                                        x: historyWindowStateMgr.x,
                                        y: historyWindowStateMgr.y})
    historyWindowStateMgr.track(historyWindow)
    historyWindow.setMenu(null)
    historyWindow.loadURL(require('url').format({
      pathname: path.join(__dirname, 'game_history.html'),
      protocol: 'file:',
      slashes: true
    }))
    if (debug) {
      historyWindow.webContents.openDevTools()
    }
    historyWindow.on('closed', function () {
      historyWindow = null;
    })
  }
  historyWindow.once('ready-to-show', () => {
    historyWindow.show()
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
ipcMain.on('openCollection', openCollectionWindow)
ipcMain.on('openInspector', openInspectorWindow)
ipcMain.on('openHistory', openHistoryWindow)

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
        return venv_path_win
    } else if (fs.existsSync(venv_path_x)) {
        return venv_path_x
    } else {
        return fallback_path // ? shrug
    }
  }
}

const selectPort = () => {
  pyPort = 5678
  return pyPort
}

port = selectPort()
global.port = port;

const generateArgs = () => {
    var args = ["-p", port]
    args.push("-i")
    args.push(logPath)
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
  let pbPath = getPyBinPath()

  let args = generateArgs()
  if (guessPackaged()) {
    try {
      mainWindow.webContents.send('stdout', {text: `calling: spawn(${script}, ${args}}`})
    } catch (error) {
      console.log("couldn't send stdout message to main window, likely already destroyed")
    }
    pyProc = require('child_process').spawn(script, args)
  } else {
    let pbArgs = ['-u', script].concat(args)  // -u for unbuffered python
    try {
      mainWindow.webContents.send('stdout', {text: `calling: spawn(${pbPath}, ${pbArgs})`})
    } catch (error) {
      console.log("couldn't send stdout message to main window, likely already destroyed")
    }
    pyProc = require('child_process').spawn(pbPath, pbArgs)
  }

  if (pyProc != null) {
    console.log('child process success on port ' + port)
    pyProc.stderr.on('data', function(data) {
      console.log("py stderr: " + data.toString());
      if (mainWindow) {
        try {
          mainWindow.webContents.send('stdout', {text: "py stderr:" + data.toString()})
        } catch (error) {
          console.log("couldn't send stdout message to main window, likely already destroyed")
        }
      }
    });
    pyProc.stdout.on('data', function(data) {
      console.log("py stdout:" + data.toString());
      if (mainWindow) {
        try {
          mainWindow.webContents.send('stdout', {text: "py stdout:" + data.toString()})
        } catch (error) {
          console.log("couldn't send stdout message to main window, likely already destroyed")
        }
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
global.sendAnonymousUsageInfo = sendAnonymousUsageInfo;
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
global.rollupMode = rollupMode;
global.hideDelay = hideDelay;
global.mouseEvents = mouseEvents;
global.winLossCounter = winLossCounter;
global.showTotalWinLossCounter = showTotalWinLossCounter;
global.showDeckWinLossCounter = showDeckWinLossCounter;
global.showDailyTotalWinLossCounter = showDailyTotalWinLossCounter;
global.showDailyDeckWinLossCounter = showDailyDeckWinLossCounter;
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
global.recentCards = recentCards
global.recentCardsQuantityToShow = recentCardsQuantityToShow
global.logPath = logPath
global.minToTray = minToTray
global.historyZoom = settings.get("history-zoom", 1.0)
global.settingsPaneIndex = "general"
global.showUIButtons = showUIButtons
global.showHideButton = showHideButton
global.showMenu = showMenu
global.inventory = inventory
global.inventorySpent = inventorySpent
global.inventoryGained = inventoryGained

/*************************************************************
 * window management
 *************************************************************/

let mainWindow = null
let settingsWindow = null
let inspectorWindow = null
let historyWindow = null
let tosWindow = null
let collectionWindow = null

let window_width = 354;
let window_height = 200;
if (debug) {
    window_width = 1220;
    window_height = 700;
}

const openDeckTrackerHandler = (menuItem, browserWindow, event) => {
    focusMTGATracker();
}

const openSettingsHandler = (menuItem, browserWindow, event) => {
  focusMTGATrackerSettings();
}

const openHistoryHandler = (menuItem, browserWindow, event) => {
  focusMTGAHistory();
}

const openInspectorHandler = (menuItem, browserWindow, event) => {
  focusInspector();
}

const openCollectionHandler = (menuItem, browserWindow, event) => {
  focusCollection();
}

const closeTrackerHandler = (menuItem, browserWindow, event) => {
  mainWindow.close();
}

let tray = null;

const createTray = () => {
  if(tray==null) {
    let iconFile = 'icon_tray.png'
    let iconPath = path.join(__dirname,'img', iconFile);
    console.log(fs.existsSync(iconPath))
    let nativeIcon = nativeImage.createFromPath(iconPath)
    tray = new Tray(nativeIcon)
    const contextMenu = Menu.buildFromTemplate([
      {label: "DeckTracker", type: "normal", click: openDeckTrackerHandler},
      {label: "Settings", type: "normal", click: openSettingsHandler},
      {label: "Inspector", type: "normal", click: openInspectorHandler},
      {label: "Collection", type: "normal", click: openCollectionHandler},
      {label: "History", type: "normal", click: openHistoryHandler},
      {label: "Quit", type: "normal", click: closeTrackerHandler }
    ])
    tray.setToolTip('MTGA Tracker')
    tray.setContextMenu(contextMenu)
    tray.on("double-click", (event, bounds) => openDeckTrackerHandler())
  }
}

const createMainWindow = () => {
  const mainWindowStateMgr = windowStateKeeper('main')
  mainWindow = new BrowserWindow({width: window_width,
                                  height: window_height,
                                  show: false,
                                  resizable: (debug || useFrame),
                                  transparent: !(debug || useFrame),
                                  frame: (debug || useFrame),
                                  alwaysOnTop: true,
                                  toolbar: false,
                                  titlebar: false,
                                  title: false,
                                  maximizable: false,
                                  icon: "img/icon_small.ico",
                                  x: mainWindowStateMgr.x,
                                  y: mainWindowStateMgr.y})
  createTray();
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
  mainWindow.on('minimize', () => {
    minToTray = settings.get('minToTray', false);
    createTray();
    mainWindow.setSkipTaskbar(minToTray)
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
    global.settingsPaneIndex = 'about'
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

function focusMTGATracker() {
  if(mainWindow) {
    mainWindow.setSkipTaskbar(false);
    mainWindow.show();
    if(mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  } else {
    openFirstWindow();
  }
}

function focusMTGATrackerSettings() {
  if(settingsWindow) {
    settingsWindow.show();
    if(settingsWindow.isMinimized()) {
      settingsWindow.restore();
    }
    settingsWindow.focus();
  } else {
    openSettingsWindow();
  }
}

function focusCollection() {
  if(collectionWindow) {
    collectionWindow.show();
    if(collectionWindow.isMinimized()) {
      collectionWindow.restore();
    }
    collectionWindow.focus();
  } else {
    openCollectionWindow();
  }
}

function focusInspector() {
  if(inspectorWindow) {
    inspectorWindow.show();
    if(inspectorWindow.isMinimized()) {
      inspectorWindow.restore();
    }
    inspectorWindow.focus();
  } else {
    openInspectorWindow();
  }

}

function focusMTGAHistory() {
  if(historyWindow) {
    historyWindow.show();
    if(historyWindow.isMinimized()) {
      historyWindow.restore();
    }
    historyWindow.focus();
  } else {
    openHistoryWindow();
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
