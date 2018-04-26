'use latest';

const express = require('express'),
      router = express.Router();

const { MongoClient, ObjectID } = require('mongodb');
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

router.get('/', (req, res, next) => {
  res.status(200).send({routes: routeDoc(router.stack)})
})

// no cover
router.post('/debug/decode-token', (req, res, next) => {
  res.status(200).send({"hello": "there"})
})

// no cover
router.get('/debug/decode-token', (req, res, next) => {
  res.status(200).send({"hello": "there"})
})

// covered: test_games_count
router.get('/games/count', (req, res, next) => {
  console.log("/games/count")
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;
  const { badge } = req.query;
  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    if (connectErr) return next(connectErr);
    let collection = client.db(DATABASE).collection(gameCollection)
    collection.count(null, null, (err, count) => {
      if (err) return next(err);
      if (badge) {
        res.set('Cache-Control', 'no-cache')
        request('https://img.shields.io/badge/Tracked%20Games-' + count + '-brightgreen.svg').pipe(res);
      } else {
        res.status(200).send({"game_count": count});
        client.close()
      }
    })
  })
})

// covered: test_unique_users_count
router.get('/users/count', (req, res, next) => {
  console.log("/users/count")
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;
  const { badge } = req.query;
  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    if (connectErr) return next(connectErr);
    let collection = client.db(DATABASE).collection(gameCollection)

    collection.distinct("players.0.name",{
            "players.0.deck.poolName": {
                $not: /.*visible cards/
            }
    }, null, (err, countZeroes) => {
      if (err) return next(err);
      collection.distinct("players.1.name",{
          "players.1.deck.poolName": {
              $not: /.*visible cards/
          }
      }, null, (err, countOnes) => {
        if (err) return next(err);
        let count = countZeroes.length + countOnes.length;
        if (badge) {
          res.set('Cache-Control', 'no-cache')
          request('https://img.shields.io/badge/Unique%20Users-' + count + '-brightgreen.svg').pipe(res);
        } else {
          res.status(200).send({"unique_user_count": count});
          client.close()
        }
      })
    })
  })
})

// covered: test_gh_cache
router.get('/gh-stat-cache', (req, res, next) => {
  console.log("/gh-stat-cache")
  getGithubStats(req.webtaskContext.storage).then((value) => {
    res.status(200).send(value)
  })
})

// covered: test_post_game
router.post('/game', (req, res, next) => {
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;
  const model = req.body;

  if (model.date === undefined) {
    model.date = Date()
  }
  let game = new Game(model)
  if (!game.isValid()) {
    res.status(400).send({error: game.validationError})
    return;
  }

  clientVersionUpToDate(model.client_version, req.webtaskContext.storage).then((clientVersionCheck) => {

    model.clientVersionOK = clientVersionCheck.ok
    model.latestVersionAtPost = clientVersionCheck.latest

    if (model.hero === undefined || model.opponent === undefined) {
      if (model.players[0].deck.poolName.includes("visible cards") && !model.players[1].deck.poolName.includes("visible cards")) {
        model.hero = model.players[1].name
        model.opponent = model.players[0].name
      } else if (model.players[1].deck.poolName.includes("visible cards") && !model.players[0].deck.poolName.includes("visible cards")) {
        model.hero = model.players[0].name
        model.opponent = model.players[1].name
      } else {
        res.status(400).send({error: "invalid schema", game: result});
        return;
      }
    }

    MongoClient.connect(MONGO_URL, (err, client) => {
      if (err) return next(err);
      //client, database, username, createIfDoesntExist, isUser
      getPublicName(client, DATABASE, model.hero, true, true).then(() => {
        getPublicName(client, DATABASE, model.opponent, true, false).then(() => {

          getGameById(client, DATABASE, game.get("gameID"), (result, err) => {
            if (result !== null) {
              res.status(400).send({error: "game already exists", game: result});
              return;
            }
            client.db(DATABASE).collection(gameCollection).insertOne(model, (err, result) => {
              client.close();
              if (err) return next(err);
              res.status(201).send(result);
            });
          })
        })
      })
    });
  })
});

module.exports = router