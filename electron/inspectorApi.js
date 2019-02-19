var { cardsColors } = require("mtga")
var { Router } = require('electron-routes');
var path = require("path")
const keytar = require('keytar')
const { MongoClient, ObjectID } = require('mongodb')

var Datastore = require('nedb')

Datastore.prototype.save = function(doc, callback) {
  let query = {_id: doc._id}
  this.update(query, doc, {upsert: true}, (err, replaced) => {
    if(callback) {
      callback(replaced)
    }
  })
}

var { databaseFiles } = require("./conf")

var db = {}
db.game = new Datastore({filename: databaseFiles.game, autoload: true });
db.deck = new Datastore({filename: databaseFiles.deck, autoload: true });
db.draft = new Datastore({filename: databaseFiles.draft, autoload: true });
db.inventory = new Datastore({filename: databaseFiles.inventory, autoload: true });

db.game.ensureIndex({field: "date"}, err => console.log)
db.game.ensureIndex({field: "gameID"}, err => console.log)
db.game.ensureIndex({field: "players.0.deck.deckID"}, err => console.log)
db.game.ensureIndex({field: "trackerIDHash"}, err => console.log)

const api = new Router('insp');

// TODO: how to format dates
//db.draft.insert({date: new Date(Date.parse("2018-09-27T22:36:04.505Z"))})

// https://hackernoon.com/functional-javascript-resolving-promises-sequentially-7aac18c4431e
const promiseSerial = funcs =>
  funcs.reduce((promise, func) =>
    promise.then(result => func().then(Array.prototype.concat.bind(result))),
    Promise.resolve([]))


api.get('sync', (req, res) => {

  var uploaded = 0
  var downloaded = 0

  var uploadConnPromises = []
  var uploadDistinctPromises = [];
  var uploadPromises = []
  var downloadConnPromises = []
  var downloadPromises = []

  keytar.getPassword("mtgatracker", "external-database-connections").then(connections => {
    if (connections) {
      var asStrings = JSON.parse(connections)
      // first, push data up
      var connectionFuncs = asStrings.map(connection => () => {
        console.log(`connecting to ${connection}`)
        return new Promise((resolve, reject) => {
          MongoClient.connect(connection, (err, client) => {
            console.log(err)
            if (client) console.log("client is good")
            var remoteCol = client.db("mtgatracker").collection("game")
            remoteCol.distinct("gameID").then(allGameIDs => {
              var localCursor = db.game.find({"gameID": {"$nin": allGameIDs}})
              localCursor.exec((err, docs) => {
                for (doc of docs) {
                  delete doc._id
                  uploaded++;
                }
                if (docs.length) {
                  remoteCol.insert(docs).then(e => {
                    resolve(uploaded);
                  })
                } else {
                  resolve(uploaded)
                }
              })
            })
          })
        })
      })

      // TODO: wait for all connections and writes to finish
      // next, pull data down
      promiseSerial(connectionFuncs).then(e => {
        var connectionFuncs = asStrings.map(connection => () => {
          console.log(`connecting to ${connection}`)
          return new Promise((resolve, reject) => {
            MongoClient.connect(connection, (err, client) => {
              console.log(err)
              if (client) console.log("client is good")
              var remoteCol = client.db("mtgatracker").collection("game")
              db.game.find({}, (err, docs) => {
                var allGameIDs = docs.map(x => x.gameID)
                remoteCursor = remoteCol.find({"gameID": {"$nin": allGameIDs}}).toArray((err, docs) => {
                  for (doc of docs){
                    delete doc._id
                    downloaded++;
                  }
                  if (docs.length) {
                    db.game.insert(docs);
                  }
                  resolve(downloaded)
                })
              })
            })
          })
        })
        promiseSerial(connectionFuncs).then(e => {
          res.json({downloaded: downloaded, uploaded: uploaded})
        })
      })
    }
  })
})

api.get('game/:gameID', (req, res) => {
  console.log("getting game")
  let cursor = db.game.findOne({_id: req.params.gameID})
  cursor.exec((err, doc) => {
    res.json(doc)
  })
});

api.get('draft/:draftID', (req, res) => {
  console.log("getting draft")
  let cursor = db.draft.findOne({_id: req.params.draftID})
  cursor.exec((err, doc) => {
    res.json(doc)
  })
});

api.get('count/decks', (req, res) => {
  db.deck.count({}, (err, count) => {
    res.json({numDecks: count})
  })
});

api.get('decks/:includeHidden', (req, res) => {
  query = {$or: [{hidden: false}, {hidden: {$exists: false}}]}
  if (req.params.includeHidden && req.params.includeHidden != 'undefined') {
    delete query.$or;
  }

  db.deck.find(query, (err, docs) => {
    for (let deck of docs) {
      deck.wins = deck.wins.length
      deck.losses = deck.losses.length
    }
    res.json({decks: docs})
  })
});

api.get('drafts/:limit', (req, res) => {
  console.log("getting drafts")
  let cursor = db.draft.find({}).sort({date: -1})
  if (req.params.limit && req.params.limit != "undefinded") {
    try {
      let limitInt = parseInt(req.params.limit)
      if (limitInt > 0) {
        cursor.limit(limitInt)
      }
    } catch (e) {
      console.log(`WARN: couldn't cast ${req.params.limit} to int`)
    }
  }
  cursor.exec((err, docs) => {
    res.json({drafts: docs})
  })
});

let createDeckFilter = (query) => {
  let queryIn = {}
  if (query) {
    let parts = query.split("&")
    for (let part of parts) {
      if (part.includes("=")) {
        let pairs = part.split("=")
        queryIn[pairs[0]] = pairs[1]
      }
    }
  }

  queryObj = {}
  filterable = {
    //"colors": "notimplemented",
    //"colorsAgainst": "notimplemented",
    "deckID": "players.0.deck.deckID",
    "opponent": "opponent"
  }
  Object.keys(queryIn).filter(key => Object.keys(filterable).includes(key)).forEach(key => {
    let filterObj = queryIn[key].toString()  // sanitize query inputs, juuuust to be safe
    queryObj[`${filterable[key]}`] = filterObj;
    // TODO: reimplement the doesntExistFilter.... somehow
//     js doesn't allow literals as keys :(
//    let matchFilter = {}
//    matchFilter[`${filterable[key]}`] = filterObj
//
//    // TODO: ....why this??
//    let doesntExistFilter = {}
//    doesntExistFilter[`${filterable[key]}`] = {$exists: false}
//
//    if (queryObj["$and"] == undefined) queryObj["$and"] = []
//    queryObj["$and"].push({
//      $or: [ matchFilter, doesntExistFilter ]
//      // match where they are equal, or the filter doesn't exist in the db, e.g. colors
//      // TODO: .... ^ what??
//    })
  })
  return queryObj
}

let fetchGames = (req, res) => {
  console.log("getting games")

  let filter = createDeckFilter(req.params.query)

  db.game.count(filter, (err, count) => {
    let pageInt = 1;

    if (req.params.page && req.params.page != "undefinded") {
      try {
        pageInt = parseInt(req.params.page)
      } catch (e) {
        console.log(`WARN: couldn't cast page ${req.params.page} to int, defaulting to page 1`)
      }
    }

    let perPage = 10;
    let numPages = Math.ceil(count / perPage);
    let cursor = db.game.find(filter).sort({date: -1})
    let docCursor = cursor.skip((pageInt - 1) * perPage).limit(perPage);
    cursor.exec((err, docs) => {
      res.json({totalPages: numPages,
                page: pageInt,
                docs: docs})
    })
  })
}

api.get('games/page=:page', fetchGames);
api.get('games/:query/page=:page', fetchGames);

api.get('deck/:deckID/winloss-colors', (req, res) => {

  console.log("/deck/winloss-colors" + JSON.stringify(req.params))

  let colors = ["White", "Red", "Green", "Blue", "Black"]
  let colorCounts = {}
  colors.forEach(color => {
    colorCounts[color] = {wins: 0, total: 0}
  })

  const addFilter = {'players.0.deck.deckID': req.params.deckID}
  let allDeckGames = db.game.find(addFilter, (err, gameArray) => {
    let allColorPromises = []
    for (let game of gameArray) {
      let oppoCardIDs = Object.keys(game.players[1].deck.cards).map(x => parseInt(x, 10))
      let oppoColorPromise = cardsColors(oppoCardIDs)
      allColorPromises.push(oppoColorPromise)
    }
    Promise.all(allColorPromises).then(allPromiseResults => {
      for (let gameIdx in allPromiseResults) {
        colors = allPromiseResults[gameIdx]
        game = gameArray[gameIdx]
        for (let oppoColor of colors) {
          if (oppoColor != "Colorless") {
            colorCounts[oppoColor].total += 1
            if (game.winner == game.hero)
              colorCounts[oppoColor].wins += 1
          }
        }
      }
      res.json(colorCounts)
    })
  })
})

api.get("event-history", (req, res) => {
  console.log("/api/event-history" + JSON.stringify(req.params))

    filter = {eventID: {$exists: true}}
    // authorizedTrackers is safe
    db.game.find(filter).sort({date: -1}).limit(200).exec((err, docs) => {
      docs.reverse()
      let firstDate = `${docs[0].date.getMonth() + 1}/${docs[0].date.getDate()}`
      let lastDate = `${docs[docs.length - 1].date.getMonth() + 1}/${docs[docs.length - 1].date.getDate()}`
      let allEventTypes = new Set(docs.map(x => x.eventID))
      let eventTypeWindows = {}
      for (let eventKey of allEventTypes) {
        eventTypeWindows[eventKey] = {
          windows: []
        }
      }
      slidingWindows = []
      let windowSize = docs.length / 13
      for (let i = 0; i < 11; i++) {
        let startIdx = i * windowSize;
        let endIdx = (i+3) * windowSize;
        let windowRecords = docs.slice(startIdx, endIdx).map(x => x.eventID)
        let windowCounts = {}
        for (let eventType of allEventTypes) {
          windowCounts[eventType] = 0
        }
        for (let record of windowRecords) {
          windowCounts[record] += 1
        }
        for (let eventTypeKey in windowCounts) {
          windowCounts[eventTypeKey] = 100 * windowCounts[eventTypeKey] / windowRecords.length;
          eventTypeWindows[eventTypeKey].windows.push(windowCounts[eventTypeKey])
        }
      }
      res.json({eventTypeWindows: eventTypeWindows, firstDate: firstDate, lastDate: lastDate})
    })
})

api.get("win-loss/by-event", (req, res) => {
  console.log("/api/win-loss/by-event" + JSON.stringify(req.params))
  filter = {eventID: {$exists: true}}
  db.game.find(filter, (err, docs) => {
    let uniqueEventIDs = new Set(docs.map(doc => doc.eventID))
    let eventCountTotals = []
    for (let eventID of uniqueEventIDs) {
      let winObj = docs.filter(event => event.eventID == eventID && event.winner == event.players[0].name)
      let wins = 0;
      if (winObj) wins = winObj.length
      let lossObj = docs.filter(event => event.eventID == eventID && event.winner != event.players[0].name)
      let losses = 0;
      if (lossObj) losses = lossObj.length
      eventCountTotals.push({eventID: eventID, wins: wins, losses: losses})
    }

    eventCountTotals.sort((a,b) => {
      let diff = (b.wins + b.losses) - (a.wins + a.losses)
      if (diff == 0) diff = b.wins - a.wins
      return diff
    })
    res.json({eventCounts: eventCountTotals})
  })
})

api.get("win-loss/", (req, res) => {
  console.log("/api/win-loss" + JSON.stringify(req.params))
  db.deck.find({}, (err, deckArray) => {
    winLoss = {wins: 0, losses: 0}
    for (let deck of deckArray) {
      winLoss.wins += deck.wins.length;
      winLoss.losses += deck.losses.length;
    }
    res.json(winLoss)
  })
})


api.get("time-stats/", (req, res) => {
  console.log("/api/time-stats" + JSON.stringify(req.params))

    filter = {elapsedTimeSeconds: {$exists: true}}
    let timeStats = {
      totalTimeSeconds: 0,
      maxTimeSeconds: -1,
      avgTimeSeconds: 0
    }
    db.game.find(filter, (err, docs) => {
      for (let game of docs) {
        timeStats.totalTimeSeconds += game.elapsedTimeSeconds
        timeStats.avgTimeSeconds += game.elapsedTimeSeconds
        timeStats.maxTimeSeconds = Math.max(game.elapsedTimeSeconds, timeStats.maxTimeSeconds)
      }
      timeStats.avgTimeSeconds /= docs.length;
      res.json({timeStats: timeStats})
    })
})

api.get("deck/:deckID/hide", (req, res) => {
  const { deckID } = req.params;
  console.log("searching for deckid " + deckID)
  db.deck.findOne({ deckID: deckID}, (err, result) => {
    if (err) throw new Error(err);
    if (result !== null) {
       result.hidden = true;
       db.deck.save(result)
       res.json({"hidden": result})
    } else {
      throw new Error({error: "not found"})
    }
  });

})

api.get("deck/:deckID/unhide", (req, res) => {
  const { deckID } = req.params;
  console.log("searching for deckid " + deckID)
  db.deck.findOne({ deckID: deckID}, (err, result) => {
    if (err) throw new Error(err);
    if (result !== null) {
       result.hidden = false;
       db.deck.save(result)
       res.json({"hidden": result})
    } else {
      throw new Error({error: "not found"})
    }
  });
})



api.post("insert-game", (req, res) => {
  console.log("POST /insert-game")

  const model = req.uploadData[0].json();

  if (model.date === undefined) {
    model.date = new Date()
  } else {
    model.date = new Date(Date.parse(model.date))
  }

  if (model.hero === undefined || model.opponent === undefined) {
    if (model.players[0].deck.poolName.includes("visible cards") && !model.players[1].deck.poolName.includes("visible cards")) {
      model.hero = model.players[1].name
      model.opponent = model.players[0].name
    } else if (model.players[1].deck.poolName.includes("visible cards") && !model.players[0].deck.poolName.includes("visible cards")) {
      model.hero = model.players[0].name
      model.opponent = model.players[1].name
    } else {
      res.json({error: "invalid schema", game: result});
      return;
    }
  }

  if (!model.elapsedTimeSeconds) {
    let totalSeconds = 0.0;
    let timeSplit = model.elapsedTime.split(":")
    totalSeconds += parseInt(timeSplit[0]) * 60 * 60;
    totalSeconds += parseInt(timeSplit[1]) * 60;
    totalSeconds += parseFloat(timeSplit[2]);
    model.elapsedTimeSeconds = totalSeconds;
  }
  for (let player of model.players) {
    if (!player.timeSpentSeconds) {
      player.timeSpentSeconds = 0.0;
      let playerTimeSplit = player.timeSpent.split(":")
      player.timeSpentSeconds += parseInt(playerTimeSplit[0]) * 60 * 60;
      player.timeSpentSeconds += parseInt(playerTimeSplit[1]) * 60;
      player.timeSpentSeconds += parseFloat(playerTimeSplit[2]);
    }
  }
  db.game.findOne({gameID: model.gameID}, (err, game) => {
    if (game) {
      return res.json({error: "game_already_exists"})
    }
    db.game.insert(model)
    let deckQuery = {deckID: model.players[0].deck.deckID}
    db.deck.findOne(deckQuery, (err, deck) => {
      if (deck == null) { // new deck, we need to make the record
        deck = {
          owner: model.hero,
          deckID: model.players[0].deck.deckID,
          deckName: model.players[0].deck.poolName,
          wins: [],
          losses: [],
        }
      }
      deck.deckName = model.players[0].deck.poolName  // get the latest name
      if (model.winner == model.hero) {
        deck.wins.push(model.gameID)
      } else {
        deck.losses.push(model.gameID)
      }
      db.deck.save(deck, e => {
        res.json(deck);
      })
    })
  });
})

api.post("rankChange", (req, res) => {
  setTimeout(e => {  // HACK: let any games currently being saved finish first.
    const model = req.uploadData[0].json();
    let gameSearch = {"players.0.userID": model.playerId}

    db.game.find(gameSearch).sort({date: -1}).limit(1).exec((err, result) => {
      if (result.length == 0) {
        return res.json({error: "no game found", game: result});
      }
      if (result[0].rankChange) {
        return res.json({error: "game already has rank", game: result});
      }
      result[0].rankChange = model;
      db.game.save(result[0])
      res.json(result[0])
    })
  }, 1000)
})


api.post("insert-draft", (req, res) => {
  console.log("POST /insert-draft")

  const model = req.uploadData[0].json();
  // hashtag nike
  db.draft.findOne({draftID: model.draftID, date: model.date}, (err, draft) => {
    if (draft) {
      return res.json({error: "draft_already_exists"})
    }
    db.draft.insert(model, e => res.json({draft: "inserted"}))
  })
})

api.post("draft-pick", (req, res) => {
  console.log("POST /draft-pick")

  const model = req.uploadData[0].json();

  let hero = model.playerId;
  let draftID = model.draftID;
  let trackerIDHash = model.trackerIDHash;

  delete model.playerId;
  delete model.draftID;
  delete model.trackerIDHash;

  db.draft.find({hero: hero, draftID: draftID}).sort({date: -1}).limit(1).exec((err, drafts) => {
    let draftObj = null;
    if (drafts.length > 0) {
      draftObj = drafts[0]
    }

    // decide if we should use existing, or create new object
    let lastPick = {packNumber: 1000, pickNumber: 1000}; // if no object to pull, feed fake data that will fail
    if (draftObj && draftObj.picks) lastPick = draftObj.picks[draftObj.picks.length - 1]
    let fitsExistingDraft = draftObj &&
      (
        lastPick.packNumber < model.packNumber ||
          (
            lastPick.packNumber == model.packNumber &&
            lastPick.pickNumber < model.pickNumber
          )
      )
    if (fitsExistingDraft) {
      draftObj.picks.push(model)
      db.draft.save(draftObj)
      return res.json(draftObj);
    } else {
      if (lastPick.packNumber == model.packNumber &&
          lastPick.pickNumber == model.pickNumber &&
          lastPick.pack == model.pack) {
            console.log("draft object is the same as the last pick! discarding")
            res.json(lastPick);
      } else {
        draftObj = {
          date: new Date(),
          picks: [model],
          hero: hero,
          draftID: draftID,
        }
        db.draft.insert(draftObj, (err, result) => {
          return res.json(result);
        })
      }
    }
  })
})

module.exports = {
  inspectorRouter: api
}