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

let debug = false;
let no_server = false;
global.debug = debug;

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
    return path.join(__dirname, "..", "venv", "Scripts", "python.exe")
}

const selectPort = () => {
  pyPort = 8080
  return pyPort
}

port = selectPort()

const createPyProc = () => {
  let script = getScriptPath()

  if (guessPackaged()) {
    pyProc = require('child_process').execFile(script, [port])
  } else {
    pyProc = require('child_process').spawn(getPyBinPath(), [script], {shell: true})
  }

  if (pyProc != null) {
    console.log('child process success on port ' + port)
  }
}

if (!no_server) {
    app.on('ready', createPyProc)
}


/*************************************************************
 * window management
 *************************************************************/

let mainWindow = null

let window_width = 354;
if (debug) {
    window_width = 1220;
}
if (!debug) {
    app.disableHardwareAcceleration()
}
const createWindow = () => {
  mainWindow = new BrowserWindow({width: window_width,
                                  height: 200,
                                  show: false,
                                  transparent: !debug,
                                  resizable: debug,
                                  frame: debug,
                                  alwaysOnTop: true,
                                  toolbar: false,
                                  titlebar: false,
                                  title: false,
                                  maximizable: false})
  mainWindow.loadURL(require('url').format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))
  if (debug) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    console.timeEnd('init')
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
   if (!no_server) {
       request.get({
        url: "http://localhost:8080/die",
        json: true,
        headers: {'User-Agent': 'request'}
      }, (err, res, data) => {
        console.log("doop");
        console.log(err, res, data)
        pyProc.kill()
        pyProc = null
        pyPort = null
        app.quit()
      })
   } else {
    app.quit()
   }
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
