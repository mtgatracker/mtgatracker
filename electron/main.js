const electron = require('electron')
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const path = require('path')
const console = require('console');
const request = require('request');
const fs = require('fs');
const findProcess = require('find-process');


/*************************************************************
 * py process
 *************************************************************/

const PY_DIST_FOLDER = 'mtgatracker_dist'
const PY_FOLDER = 'app'
const PY_MODULE = 'main' // without .py suffix

let pyProc = null
let pyPort = null

let debug = false;
let showIIDs = true;
let no_server = false;
let kill_server = true;
let server_killed = false;
let noFollow = false;
let readFullFile = false;
let debugFile = false;

const guessPackaged = () => {
  const fullPath = path.join(__dirname, PY_DIST_FOLDER)
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

const cleanupOldPyProc = (cb)  => {
    findProcess('port', 5678)
      .then(function (list) {
        list.forEach(function(proc) {
            console.log("leftover python process @ " + proc.pid + ", killing...")
            process.kill(proc.pid)
        })
        cb()
      }, function (err) {
        console.log(err.stack || err);
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
    cleanupOldPyProc(createPyProc)
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
        if (!no_server) {
            freeze(2000)
            process.kill(pyProc.pid)
        }
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

app.on('beforeunload', (e) => {
    console.log("onbeforeunload app")
    return false;
    e.returnValue = "false";
})
