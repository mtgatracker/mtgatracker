var { app, autoUpdater } = require('electron');
const fs = require('fs')
const path = require('path')
const ChildProcess = require('child_process');
const appFolder = path.resolve(process.execPath, '..');
const rootAtomFolder = path.resolve(appFolder, '..');
const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));

const exeName = path.basename(process.execPath);

const spawn = function(command, args) {
  let spawnedProcess, error;
  try {
    spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
  } catch (error) {}
  return spawnedProcess;
};

const spawnUpdate = function(args) {
  return spawn(updateDotExe, args);
};


var handleStartupEvent = function() {
  if (process.platform !== 'win32') {
    return false;
  }

  var squirrelCommand = process.argv[1];
  switch (squirrelCommand) {
    case '--squirrel-install':
    case '--squirrel-updated':

      // - Install desktop and start menu shortcuts
      spawnUpdate(['--createShortcut', exeName]);

      // Always quit when done
      setTimeout(app.quit, 1000);
      return true;
    case '--squirrel-uninstall':
      // Remove desktop and start menu shortcuts
      spawnUpdate(['--removeShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;
    case '--squirrel-obsolete':
      // This is called on the outgoing version of your app before
      // we update to the new version - it's the opposite of
      // --squirrel-updated
      app.quit();
      return true;

  }
};

const GhReleases = require('electron-gh-releases')

let options = {
  repo: 'mtgatracker/mtgatracker-updates',
  currentVersion: app.getVersion()
}

const updater = new GhReleases(options)
updater.autoUpdater.autoDownload = false;  // fix issue where multiple downloaders fight over the lock

module.exports = {
  handleStartupEvent: handleStartupEvent,
  updater: updater,
}