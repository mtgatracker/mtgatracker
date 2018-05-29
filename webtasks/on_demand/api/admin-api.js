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

// nocover
router.get('/', (req, res, next) => {
  res.status(200).send({routes: routeDoc(router.stack)})
})

// nocover
router.get('/test-verify-game/:game/:gameHash', (req, res, next) => {
  const gi = req.params.game;
  const gh = req.params.gameHash;
  const { HASH_PASS } = req.webtaskContext.secrets;
  res.status(200).send({"v": secrets.verifyGame({ gameID: gi }, gh, HASH_PASS)})
})


// covered: test_user_client_versions
router.get('/users/client_versions', (req, res, next) => {
  console.log("/users/client_versions")
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;
  const { badge } = req.query;
  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    if (connectErr) return next(connectErr);
    let collection = client.db(DATABASE).collection(gameCollection)

    let cursor = collection.find({date: {$exists: true}}).sort({_id: -1}).limit(200);

    cursor.toArray((cursorErr, docs) => {
      if (cursorErr) return next(cursorErr);
      let counts = {}

      counts.get = function (key) {
          if (counts.hasOwnProperty(key)) {
              return counts[key];
          } else {
              return 0;
          }
      }

      docs.forEach(function(doc, idx) {
        if (doc.client_version != undefined) {
          counts[doc.client_version] = counts.get(doc.client_version) + 1
        } else {
          counts["none"] = counts.get("none") + 1
        }
      })
      res.status(200).send({
        count: Math.min(200, docs.length),
        counts: counts
      });
    })
  })
})

// covered: test_get_all_games
router.get('/games', (req, res, next) => {
  console.log("admin /games")
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;
  if (req.query.per_page) {
    var per_page = parseInt(req.query.per_page)
  } else {
    var per_page = 10;
  }
  const { page = 1} = req.query;

  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    if (connectErr) return next(connectErr);
    let collection = client.db(DATABASE).collection(gameCollection)
    collection.count(null, null, (err, count) => {
      let numPages = Math.ceil(count / per_page);
      let cursor = collection.find().skip((page - 1) * per_page).limit(per_page);
      cursor.toArray((cursorErr, docs) => {
        if (cursorErr) return next(cursorErr);
        res.status(200).send({
            totalPages: numPages,
            page: page,
            docs: docs
        });
      })
      client.close()
    })
  })
})

// covered: test_get_user_games_admin
router.get('/games/user/:username', (req, res, next) => {
  console.log("games/user/" + JSON.stringify(req.params))
  if (req.query.per_page) {
    var per_page = parseInt(req.query.per_page)
  } else {
    var per_page = 10;
  }
  const { page = 1} = req.query;
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;
  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    const { username } = req.params;
    if (connectErr) return next(connectErr);
    let collection = client.db(DATABASE).collection(gameCollection)
    let cursor = collection.find({'players.name': username});
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

// covered: test_get_users_games_by_user_id_admin
router.get('/games/userID/:userID', (req, res, next) => {
  console.log("games/userID/" + JSON.stringify(req.params))
  if (req.query.per_page) {
    var per_page = parseInt(req.query.per_page)
  } else {
    var per_page = 10;
  }
  const { MONGO_URL, DATABASE} = req.webtaskContext.secrets;
  const { page = 1} = req.query;

  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    const { userID } = req.params;
    if (connectErr) return next(connectErr);
    let collection = client.db(DATABASE).collection(gameCollection)
    let cursor = collection.find({'players.userID': userID});  // hard-limit to 5 records for example
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

// no cover - for testing only
router.post('/games/no-verify', (req, res, next) => {
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;
  const games = req.body.games;

  if (DATABASE != "mtga-tracker-staging") {
    res.status(400).send({error: "not allowed to do this anywhere except staging, sorry"})
    return
  }

  MongoClient.connect(MONGO_URL, (err, client) => {
    client.db(DATABASE).collection(gameCollection).insertMany(games, null, (err, result) => {
      client.close();
      if (err) return next(err);
      res.status(201).send(result);
    });
  })
})

// covered: test_gh_cache
router.delete('/gh-stat-cache', (req, res, next) => {
  req.webtaskContext.storage.set(undefined, {force: 1}, (err) => {
    console.log("DEL /gh-stat-cache")
    if (err) res.status(500).send(err)
    else res.status(200).send({ok: true})
  })
})

// covered: test_get_publicname
router.get('/publicName/:username', (req, res, next) => {
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;

  const { username } = req.params;

  MongoClient.connect(MONGO_URL, (err, client) => {
    getPublicName(client, DATABASE, username).then((pubNameObj) => {
      if (pubNameObj.result) {
        res.status(200).send(pubNameObj.result)
      } else {
        res.status(404).send({error: "no pubname found for user " + username})
      }
    })
  })
})

// no cover - for testing only
router.post('/game/no-verify', (req, res, next) => {
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;
  const model = req.body;

  if (DATABASE != "mtga-tracker-staging") {
    res.status(400).send({error: "not allowed to do this anywhere except staging, sorry"})
    return
  }

  MongoClient.connect(MONGO_URL, (err, client) => {
    client.db(DATABASE).collection(gameCollection).insertOne(model, (err, result) => {
      client.close();
      if (err) return next(err);
      res.status(201).send(result);
    });
  })
})

// covered: test_post_games
router.post('/games', (req, res, next) => {
  console.log("POST admin /games")
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;
  const games = req.body.games;

  let okGames = []
  let nonDupes = []
  let gameIDs = []

  let results = []
  let errors = []

  let promises = []

  // filter out games that are dupes within this request, first
  games.forEach((model, idx) => {
    if (gameIDs.indexOf(model.gameID) != -1) {
      errors.push({error: "dup model in this request: " + model.gameID})
    } else {
      gameIDs.push(model.gameID)
      nonDupes.push(model)
    }
  })

  // filter out games that are dupes in the database next
  MongoClient.connect(MONGO_URL, (err, client) => {
    nonDupes.forEach((model, idx) => {
      if (model.date === undefined) {
        model.date = new Date()
      } else {
        model.date = new Date(Date.parse(model.date))
      }
      let game = new Game(model)
      if (!game.isValid()) {
        errors.push({error: game.validationError})
      } else {
        if (err) errors.push(err);
        promises.push(getGameById(client, DATABASE, model.gameID, (result, err) => {
          if (result !== null) {
            errors.push({error: "game already exists", game: model.gameID})
          } else {
            okGames.push(model)
            gameIDs.push(model.gameID)
          }
        }))
      }
    })
    Promise.all(promises).then((value) => {

      client.db(DATABASE).collection(gameCollection).insertMany(okGames, null, (err, result) => {
        if (err) errors.push(err);
        results.push(result)
      })
      client.close();
    })

    if (errors.length > 0) {
      res.status(400).send({errors: errors, results: results});
    } else {
      res.status(201).send({results: results});
    }
  })
});


module.exports = router