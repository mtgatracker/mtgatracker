const { indexedDB } = window
console.log(indexedDB)
const databaseRev = 1;
const gameStore = "game";

const dbReq = indexedDB.open("mtgatracker", databaseRev)
var db;

dbReq.onupgradeneeded = function(event) {
    let db = event.target.result;
    let games = db.createObjectStore(gameStore, {keyPath: '_id'});
    games.createIndex("games_unique_id", "_id", {unique: true})
};

function ready() {
  return new Promise((resolve, reject) => {
    if (db) {
      console.log("already have db")
      resolve(db)
    } else {
      console.log("must fetch DB")
      dbReq.onsuccess = function(event) {
        db = event.target.result;
        resolve(db)
      }
    }
  })
}

function getGame(id) {
  return new Promise((resolve, reject) => {
    ready().then(db => {
      let dbReadTx = db.transaction(gameStore)
      let localGames = dbReadTx.objectStore(gameStore)
      let txResult = localGames.get(id)
      txResult.onsuccess = event => {
        resolve(event.target.result)
      }
    })
  })
}

function putGame(game) {
  return new Promise((resolve, reject) => {
    ready().then(db => {
      let dbReadTx = db.transaction(gameStore, 'readwrite')
      let localGames = dbReadTx.objectStore(gameStore)
      let txResult = localGames.put(game)
      txResult.onsuccess = event => {
        resolve(event.target.result)
      }
    })
  })
}

module.exports = {
  ready: ready,
  init: ready,
  getGame: getGame,
  putGame: putGame,
  gameStore: gameStore,
}