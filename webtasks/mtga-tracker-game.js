'use latest';

import bodyParser from 'body-parser';
import express from 'express';
import Webtask from 'webtask-tools';
import { MongoClient, ObjectID } from 'mongodb';
var backbone = require('backbone');
var request = require('request');

const Game = backbone.Model.extend({
  validate: function(attr) {
    let err = []
    if (attr.players === undefined) err.push("must have players")
    if (attr.winner === undefined) err.push("must have a winner")
    if (attr.gameID === undefined) err.push("must have a gameID")
    if (!Array.isArray(attr.players)) err.push("players must be an array")
    if(err.length) return err  // checkpoint
    if (attr.players.length === 0) err.push("players must not be empty")
    let winnerFound = false
    attr.players.forEach(function(player, idx) {
      if (player.name === undefined) err.push("players[" + idx + "] must have a name")
      if (player.userID === undefined) err.push("players[" + idx + "] must have a userID")
      if (player.deck === undefined) err.push("players[" + idx + "] must have a deck")
      if (player.name === attr.winner) winnerFound = true
    })
    if (!winnerFound) err.push("winner " + attr.winner + " not found in players")
    if(err.length) return err  // checkpoint
  }
})

const deckCollection = 'deck';
const gameCollection = 'game';
const userCollectionCollection = 'userCollection';
const errorCollection = 'error';
const server = express();


server.use(bodyParser.json());

// covered: test_games_count
server.get('/games/count', (req, res, next) => {
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
server.get('/users/count', (req, res, next) => {
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


// covered: test_unique_users_count
server.get('/users/client_versions', (req, res, next) => {
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
server.get('/games', (req, res, next) => {
  console.log("/games")
  const { MONGO_URL, DEBUG_PASSWORD, DATABASE } = req.webtaskContext.secrets;
  if (req.query.per_page) {
    var per_page = parseInt(req.query.per_page)
  } else {
    var per_page = 10;
  }
  const { debug_password, page = 1} = req.query;

  if (debug_password != DEBUG_PASSWORD) {
    res.status(400).send({error: "debug password incorrect"})
    return
  }

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

// covered: test_get_user_games
server.get('/games/user/:username', (req, res, next) => {
  console.log("games/user/" + JSON.stringify(req.params))
  if (req.query.per_page) {
    var per_page = parseInt(req.query.per_page)
  } else {
    var per_page = 10;
  }
  const { debug_password, page = 1} = req.query;
  const { MONGO_URL, DEBUG_PASSWORD, DATABASE } = req.webtaskContext.secrets;
  if (debug_password != DEBUG_PASSWORD) {
    res.status(400).send({error: "debug password incorrect"})
    return
  }
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

// covered: test_get_users_games_by_user_id
server.get('/games/userID/:userID', (req, res, next) => {
  console.log("games/userID/" + JSON.stringify(req.params))
  if (req.query.per_page) {
    var per_page = parseInt(req.query.per_page)
  } else {
    var per_page = 10;
  }
  const { MONGO_URL, DEBUG_PASSWORD, DATABASE} = req.webtaskContext.secrets;
  const { debug_password, page = 1} = req.query;
  if (debug_password != DEBUG_PASSWORD) {
    res.status(400).send({error: "debug password incorrect"})
    return
  }
  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    const { userID } = req.params ;
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

// covered: test_get_game
server.get('/game/_id/:_id', (req, res, next) => {
  const { MONGO_URL, DEBUG_PASSWORD, DATABASE } = req.webtaskContext.secrets;
  const { debug_password } = req.query;
  if (debug_password != DEBUG_PASSWORD) {
    res.status(400).send({error: "debug password incorrect"})
    return
  }
  MongoClient.connect(MONGO_URL, (err, client) => {
    const { _id } = req.params ;
    if (err) return next(err);
    client.db(DATABASE).collection(gameCollection).findOne({ _id: new ObjectID(_id) }, (err, result) => {
      client.close();
      if (err) return next(err);
      if (result !== null) res.status(200).send(result)
      else res.status(404).send(result)
    });
  });
});

let getGameById = (client, database, gameID, callback) => {
    console.log({ gameID: gameID })
    client.db(database).collection(gameCollection).findOne({ gameID: gameID }, null, (err, result) => {
      console.log(err)
      console.log(result)
      callback(result, err)
    });
}

let logError = (client, database, error, callback) => {
    client.db(database).collection(errorCollection).insertOne(error, null, (err, result) => {
      callback(result, err)
    });
}

// covered: test_get_game
server.get('/game/gameID/:gid', (req, res, next) => {
  const { MONGO_URL, DEBUG_PASSWORD, DATABASE } = req.webtaskContext.secrets;
  const { debug_password } = req.query;
  if (debug_password != DEBUG_PASSWORD) {
    res.status(400).send({error: "debug password incorrect"})
    return
  }
  MongoClient.connect(MONGO_URL, (err, client) => {
    const gid = req.params.gid;
    getGameById(client, DATABASE, gid, (result, err) => {
      client.close();
      if (err) return next(err);
      if (result !== null) res.status(200).send(result)
      else res.status(404).send(result)
    });
  });
});

// covered: test_post_game
server.post('/game', (req, res, next) => {
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;
  // Do data sanitation here.
  const model = req.body;
  if (model.date === undefined) {
    model.date = Date()
    console.log("had to manually set date")
  }
  let game = new Game(model)
  if (!game.isValid()) {
    res.status(400).send({error: game.validationError})
    return;
  }
  MongoClient.connect(MONGO_URL, (err, client) => {
    if (err) return next(err);
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
  });
});

// TODO: uncovered!
server.post('/danger/reset/all', (req, res, next) => {
  console.log("danger!!!")
  const { MONGO_URL, DEBUG_PASSWORD, DATABASE } = req.webtaskContext.secrets;
  const { debug_password } = req.body;
  if (debug_password != DEBUG_PASSWORD) {
    res.status(400).send({error: "debug password incorrect"})
    return
  }
  if (DATABASE != "mtga-tracker-staging") {
    res.status(400).send({error: "not allowed to do this anywhere except staging, sorry"})
    return
  }
  MongoClient.connect(MONGO_URL, (err, client) => {
    if (err) return next(err);
    client.db(DATABASE).collection(gameCollection).drop(null, (err, result) => {
      if (err) return next(err);
      if (result !== null) res.status(200).send(result)
      else res.status(400).send(result)
      client.close();
    });
  });
});

// covered: asd
server.get('*', function(req, res) {
  console.log('retrieving page: ' + JSON.stringify(req.params))

  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;
  MongoClient.connect(MONGO_URL, (err, client) => {
   logError(client, DATABASE, {error: "unknown access: " +  JSON.stringify(req.params)}, (result, err) => {
      client.close();
      if (err) return next(err);
      res.status(404).send({error: "route is not valid", warning: "this access has been logged; if you are misusing this API, your address may be banned!"})
   })
  })
})

module.exports = Webtask.fromExpress(server);
