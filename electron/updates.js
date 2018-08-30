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

// Setting up auto-update on mac fails because we're not code-signed
if(process.platform !== 'darwin') {
  var updateFeed = 'https://s3-us-west-1.amazonaws.com/mtgatracker/autoupdates/win';

  //if (process.env.NODE_ENV !== 'development') {
  //  updateFeed = process.platform === 'darwin' ?
  //    'https://s3-us-west-1.amazonaws.com/mtgatracker/autoupdates/osx' :
  //    'https://s3-us-west-1.amazonaws.com/mtgatracker/autoupdates/win';
  //}
  if (process.env.NODE_ENV !== 'development') {
    updateFeed = process.platform === 'darwin' ?
      'https://s3-us-west-1.amazonaws.com/mtgatracker/autoupdates/osx' :
      'https://s3-us-west-1.amazonaws.com/mtgatracker/autoupdates/win';
  }

  autoUpdater.setFeedURL(updateFeed);

  autoUpdater.on('update-available', () => {
    console.log('update available v2.2.5')
  })

  autoUpdater.on('checking-for-update', () => {
    console.log('checking-for-update v2.2.5')
  })

  autoUpdater.on('update-not-available', () => {
    console.log('update-not-available v2.2.5')
  })
}

module.exports = {
  handleStartupEvent: handleStartupEvent,
}
