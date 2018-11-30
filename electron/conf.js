const path = require('path')
var { app, remote } = require("electron")

const eApp = app || remote.app;
const userDataPath = eApp.getPath('userData');

var databaseFiles = {
  game: path.join(userDataPath, "inspector-game.db"),
  deck: path.join(userDataPath, "inspector-deck.db"),
  draft: path.join(userDataPath, "inspector-draft.db"),
  inventory: path.join(userDataPath, "inspector-inventory.db"),
}

module.exports = {databaseFiles: databaseFiles}