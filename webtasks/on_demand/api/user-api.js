'use latest';

const express = require('express'),
      router = express.Router();

const { cardsColors } = require("mtga")

const {
  clientVersionUpToDate,
  createAnonymousToken,
  createDeckFilter,
  createToken,
  differenceMinutes,
  Game,
  getCookieToken,
  getGameById,
  getGithubStats,
  getPublicName,
  logError,
  parseVersionString,
  random6DigitCode,
  randomString,
  routeDoc,
  sendDiscordMessage,
  deckCollection,
  gameCollection,
  userCollection,
  errorCollection,
} = require('../../util')

var secrets; // babel makes it so we can't const this, I am pretty sure
try {
  secrets = require('../secrets.js')
} catch (e) {
  secrets = require('../secrets-template.js')
}

import { MongoClient, ObjectID } from 'mongodb';

router.get('/', (req, res, next) => {
  res.status(200).send({routes: routeDoc(router.stack)})
})


// covered: test_get_user_games
router.get('/games', (req, res, next) => {
  console.log("/api/games" + JSON.stringify(req.params))
  if (req.query.per_page) {
    var per_page = parseInt(req.query.per_page)
  } else {
    var per_page = 10;
  }
  const { page = 1 } = req.query;
  const { user } = req.user;
  const addFilter = Object.assign({'players.name': user}, createDeckFilter(req.query))

  console.log(`=========================> using filter ${JSON.stringify(addFilter)}`)

  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;

  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    if (connectErr) return next(connectErr);
    let collection = client.db(DATABASE).collection(gameCollection)
    let cursor = collection.find(addFilter).sort({date: -1});
    cursor.count(null, null, (err, count) => {
      let numPages = Math.ceil(count / per_page);
      let docCursor = cursor.skip((page - 1) * per_page).limit(per_page);

      docCursor.toArray((cursorErr, docs) => {
        if (cursorErr) return next(cursorErr);
        res.status(200).send({
          totalPages: numPages,
          page: page,
          docs: docs
        });
        client.close()
      })
    })
  })
})

router.get('/deck/:deckID/winloss-colors', (req, res, next) => {

  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;

  console.log("/deck/winloss-colors" + JSON.stringify(req.params))
  const { user } = req.user;
  let colors = ["White", "Red", "Green", "Blue", "Black"]
  let colorCounts = {}
  colors.forEach(color => {
    colorCounts[color] = {wins: 0, total: 0}
  })

  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    if (connectErr) return next(connectErr);
    let collection = client.db(DATABASE).collection(gameCollection)
    const addFilter = {'hero': user, 'players.0.deck.deckID': req.params.deckID}
    let allDeckGames = collection.find(addFilter)
    allDeckGames.toArray((err, gameArray) => {
      let allColorPromises = []
      gameArray.forEach(game => {
        let oppoCardIDs = Object.keys(game.players[1].deck.cards).map(x => parseInt(x, 10))
        let oppoColorPromise = cardsColors(oppoCardIDs)
        allColorPromises.push(oppoColorPromise)
        oppoColorPromise.then(colors => {
          colors.forEach(oppoColor => {
            if (oppoColor != "Colorless") {
              colorCounts[oppoColor].total += 1
              if (game.winner == user)
                colorCounts[oppoColor].wins += 1
            }
          })
        })
      })
      Promise.all(allColorPromises).then(unused => {
        res.status(200).send(colorCounts)
      })
    })
  })
})

// covered: test_get_user_decks
router.get('/decks', (req, res, next) => {
  console.log("/api/decks" + JSON.stringify(req.params))
  if (req.query.per_page) {
    var per_page = parseInt(req.query.per_page)
  } else {
    var per_page = 10;
  }

  const { page = 1 } = req.query;

  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;

  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    const { user } = req.user;
    if (connectErr) return next(connectErr);
    let collection = client.db(DATABASE).collection(gameCollection)
    let decks = []
    collection.distinct("players.0.deck.deckID", {"players.0.name": user}, null, (err, deckIDs) => {
      let allPromises = []
      deckIDs.forEach((deckID, idx) => {
        allPromises.push(collection.count({"players.0.deck.deckID": deckID, winner: user}, null))
        allPromises.push(collection.count({"players.0.deck.deckID": deckID, winner: {$ne: user}}, null))
        allPromises.push(collection.findOne({"players.0.deck.deckID": deckID}, {sort: [["date", -1]]}))
      })
      Promise.all(allPromises).then(pushed => {
        let deckReturn = {}
        while(pushed.length > 1) {
          let deck = pushed.pop()
          let lossCount = pushed.pop()
          let winCount = pushed.pop()
          deckReturn[deck.players[0].deck.deckID] = {
            deckName: deck.players[0].deck.poolName,
            deckID: deck.players[0].deck.deckID,
            wins: winCount,
            losses: lossCount
          }
        }
        res.status(200).send(deckReturn)
      })
    })
  })
})

// covered: test_get_game
router.get('/game/_id/:_id', (req, res, next) => {
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;
  MongoClient.connect(MONGO_URL, (err, client) => {
    const { _id } = req.params;
    if (err) return next(err);
    client.db(DATABASE).collection(gameCollection).findOne({ _id: new ObjectID(_id) }, (err, result) => {
      client.close();
      if (err) return next(err);
      if(req.user.user != result.hero) res.status(401).send({"error": "not authorized"})
      else if (result !== null) res.status(200).send(result)
      else res.status(404).send(result)
    });
  });
});

// covered: test_get_game
router.get('/game/gameID/:gid', (req, res, next) => {
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;

  MongoClient.connect(MONGO_URL, (err, client) => {
    const gid = req.params.gid;
    getGameById(client, DATABASE, gid, (result, err) => {
      client.close();
      if (err) return next(err);
      if(req.user.user != result.hero) res.status(401).send({"error": "not authorized"})
      else if (result !== null) res.status(200).send(result)
      else res.status(404).send(result)
    });
  });
});

module.exports = router