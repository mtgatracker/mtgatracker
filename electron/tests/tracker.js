const Application = require('spectron').Application
const assert = require('assert')
const electronPath = require('electron') // Require Electron from the binaries included in node_modules.
const path = require('path')
const fs = require('fs')

const debugFilePath = path.join(__dirname, "test_output_log.txt")

let settingsPath;
let settingsPathBak;

/*
appdata_roaming = os.getenv("APPDATA")
self._settings_path = os.path.join(appdata_roaming, "..", "LocalLow", "MTGATracker")
self._settings_json_path = os.path.join(self._settings_path, "settings.json")
*/

let appDataRoaming = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + 'Library/Preferences' : '/var/local')

let pythonSettingsPath = path.join(appDataRoaming, "..",  "LocalLow", "MTGATracker", "settings.json");
let pythonSettingsPathBak = pythonSettingsPath + ".test.bak";

// https://github.com/electron/spectron#application-api

let addToDebugFile = contents => {
  fs.appendFileSync(debugFilePath, contents)
}

let addDecklists = e => {
  addToDebugFile(fs.readFileSync(path.join(__dirname, "strings", "decklists.txt")))
}

describe('MTGATracker Tests Setup', function () {
  this.timeout(10000)

  before(function () {
    // back up the original settings file
    fs.writeFileSync(debugFilePath, '')
    let app = new Application({
      path: electronPath,
      args: [path.join(__dirname, '..'), "-u", "-i", debugFilePath]
    })
    return new Promise((resolve, reject) => {
      app.start().then(e => {
        return app.electron.remote.getGlobal("settingsPath")
      }).then(foundSettingsPath => {
        settingsPath = foundSettingsPath
        settingsPathBak = settingsPath + ".test.bak"
        return app.stop()
      }).then(e => {
        fs.renameSync(pythonSettingsPath, pythonSettingsPathBak)
        resolve(fs.renameSync(settingsPath, settingsPathBak))
      })
    })
  })

  after(function() {
    // restore the original settings file
    fs.renameSync(settingsPathBak, settingsPath)
    return fs.renameSync(pythonSettingsPathBak, pythonSettingsPath)
  })

  describe('MTGATracker First Launch Tests', function() {

    before(function() {
      this.app = new Application({
        path: electronPath,
        args: [path.join(__dirname, '..'), "-u", "-i", debugFilePath]
      })
      return this.app.start()
    })

    after(function () {
      if (this.app && this.app.isRunning()) {
        return this.app.stop()
      }
    })

    it('requires ToS agreement on first launch', function () {
      return this.app.client.getTitle().then(title => {
        assert.equal(title, "Terms of Services")
      }).getWindowCount().then(count => {
        assert.equal(count, 1)
      })
    })

    it('shows changelog on first launch after ToS agreed', function () {
      return this.app.client
        .waitUntilWindowLoaded()
        .click("#agree")
        .then(clicked => {
          return this.app.client.getWindowCount().then(count => {
            assert.equal(count, 2)
          })
        })
    })
  })

  describe('MTGATracker Second Launch Tests', function() {

    before(function() {
      this.app = new Application({
        path: electronPath,
        args: [path.join(__dirname, '..'), "-u", "-s", "-i", debugFilePath],
        webdriverOptions: {
          "deprecationWarnings": false
        }
      })
      return this.app.start()
    })

    after(function () {
      if (this.app && this.app.isRunning()) {
        return this.app.stop()
      }
    })

    it('doesn\'t show changelog on subsequent launches', function () {
      return this.app.client
        .waitUntilWindowLoaded()
        .getWindowCount().then(count => {
          assert.equal(count, 1)
        }).getTitle().then(title => {
          assert.equal(title, "MTGA Tracker")
        })
    })

    it('shows first-launch notifications', function () {
      this.timeout(30000)
      return this.app.client
        .waitUntilWindowLoaded()
        .waitUntilTextExists(".message-container", "We've updated our New Tracker Guide with the latest list of features, and some Quick Tips. Come check it out!")
        .isVisible(".message-container").then(visible => {
          assert.equal(visible.some(v => v == true), true)
        })
        // dismiss most of the notifications, but not all of them
        .leftClick('body', 70, 140)
        .leftClick('body', 70, 140)
        .leftClick('body', 70, 140)
        .leftClick('body', 70, 140)
        .leftClick('body', 70, 140)
        .isVisible('#decklists-container p.message-container[messageid="welcome_0"]').then(visible => {
          assert.equal(visible, false)
        })
    })
  })

  describe('MTGATracker Third Launch Tests', function() {

    before(function() {
      this.app = new Application({
        path: electronPath,
        args: [path.join(__dirname, '..'), "-u", "-i", debugFilePath],
        webdriverOptions: {
          "deprecationWarnings": false
        }
      })
      return this.app.start()
    })

    after(function () {
      if (this.app && this.app.isRunning()) {
        return this.app.stop()
      }
    })

    it('doesn\'t show dismissed notifications', function () {
      return this.app.client
        .waitUntilWindowLoaded()
        .waitUntilTextExists(".message-container", "We've updated our New Tracker Guide with the latest list of features, and some Quick Tips. Come check it out!")
        .isVisible('#decklists-container p.message-container[messageid="welcome_0"]').then(visible => {
          assert.equal(visible, false)
        })
    })

    it('uses our log file', function () {
      return this.app.electron.remote.getGlobal("logPath").then(logPath => {
        assert.equal(logPath, debugFilePath)
      })
    })

    it('sees changes to the log file', done => {
      this.timeout(10000)
      addDecklists()
      setTimeout(e => {
        console.log("did it see new decks?")
        done()
      }, 9000)
    })
  })
})