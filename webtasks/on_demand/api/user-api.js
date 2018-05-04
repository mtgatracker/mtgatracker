'use latest';

const express = require('express'),
      router = express.Router();
const {
  clientVersionUpToDate,
  createAnonymousToken,
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
  const { page = 1} = req.query;

  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;

  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    const { user } = req.user;
    if (connectErr) return next(connectErr);
    let collection = client.db(DATABASE).collection(gameCollection)
    let cursor = collection.find({'players.name': user});
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