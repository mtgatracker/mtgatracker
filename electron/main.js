const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const path = require('path')
const console = require('console');
const request = require('request');


/*************************************************************
 * py process
 *************************************************************/

const PY_DIST_FOLDER = 'mtgatracker_dist'
const PY_FOLDER = 'app'
const PY_MODULE = 'main' // without .py suffix

let pyProc = null
let pyPort = null

let debug = true;
let showIIDs = true;
let no_server = true;
let kill_server = true;
let server_killed = false;
let noFollow = false;
let readFullFile = false;
let debugFile = false;

const guessPackaged = () => {
  const fullPath = path.join(__dirname, PY_DIST_FOLDER)
  return require('fs').existsSync(fullPath)
}

const getScriptPath = () => {
  if (!guessPackaged()) {
    return path.join(__dirname, "..", PY_FOLDER, PY_MODULE + '.py')
  }
  if (process.platform === 'win32') {
    return path.join(__dirname, "..", "..", PY_DIST_FOLDER, PY_MODULE, PY_MODULE + '.exe')
  }
  return path.join(__dirname, "..", "..", PY_DIST_FOLDER, PY_MODULE, PY_MODULE)
}

const getPyBinPath = () => {
  if (process.platform === 'win32') {
    return path.join(__dirname, "..", "venv", "Scripts", "python.exe")
  } else {
    return path.join(__dirname, "..", "venv", "bin", "python")
  }
}

const getLogFilePath = () => {
    // TODO: make this cmd-line configurable
    return path.join(__dirname, "..", "example_logs", "output_log.txt")
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
    return args
}


const createPyProc = () => {
  let script = getScriptPath()

  if (guessPackaged()) {
    pyProc = require('child_process').execFile(script, generateArgs())
  } else {
    pyProc = require('child_process').spawn(getPyBinPath(), [script].concat(generateArgs()), {shell: true})
    console.log(getPyBinPath(), [script].concat(generateArgs()))
  }

  if (pyProc != null) {
    console.log('child process success on port ' + port)
  }
}

if (!no_server) {
    createPyProc()
    freeze(5000)
}

global.debug = debug;
global.showIIDs = showIIDs;


/*************************************************************
 * window management
 *************************************************************/

let mainWindow = null

let window_width = 354;
let window_height = 200;
if (debug) {
    window_width = 1220;
    window_height = 700;
}
if (!debug) {
    app.disableHardwareAcceleration()
}
const createWindow = () => {
  mainWindow = new BrowserWindow({width: window_width,
                                  height: window_height,
                                  show: false,
                                  transparent: !debug,
                                  resizable: debug,
                                  frame: debug,
                                  alwaysOnTop: true,
                                  toolbar: false,
                                  titlebar: false,
                                  title: false,
                                  maximizable: false,
                                  icon: "img/icon.ico"})
  mainWindow.loadURL(require('url').format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))
  if (debug) {
    mainWindow.webContents.openDevTools()
  }
  mainWindow.onbeforeunload = (e) => {
    var answer = confirm('Do you really want to close the application?');
    console.log("onbeforeunload mw")
    e.returnValue = false
  }
  mainWindow.on('closed', () => {
    console.log("closed")
    return false;
//    mainWindow = null
  })
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    console.timeEnd('init')
  })
}
function freeze(time) {
    const stop = new Date().getTime() + time;
    while(new Date().getTime() < stop);
}
const killServer = () => {
    if (!server_killed && kill_server) {
        server_killed = true;
        console.log("sending die")
        ws.send("die")
        freeze(3000)  // no way to verify is die was sent, so let's just wait a little
        if (!no_server)
            pyProc.kill()
        pyProc = null
        pyPort = null
        app.quit()
    }
}

app.on('ready', createWindow)

app.on('before-quit', function() {
  console.log("boutta quit")
  killServer()
})

app.on('will-quit', function() {
  console.log("quitting")
  killServer()
})

app.on('window-all-closed', () => {
    killServer()
})

//app.on('activate', () => {
//  if (mainWindow === null) {
//    createWindow()
//
//  }
//})

app.on('beforeunload', (e) => {
    console.log("onbeforeunload app")
    return false;
    e.returnValue = "false";
})
