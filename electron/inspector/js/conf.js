var localDB = require('./localDB')

localDB.init().then(db => {
  window.db = db;
})

module.exports = {
  localDB: localDB,
  pagePrefix: "."
}