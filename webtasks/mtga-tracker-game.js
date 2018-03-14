'use latest';

import bodyParser from 'body-parser';
import express from 'express';
import Webtask from 'webtask-tools';
import { MongoClient, ObjectID } from 'mongodb';
var backbone = require('backbone');

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
      if (player.deck === undefined) err.push("players[" + idx + "] must have a deck")
      if (player.name === attr.winner) winnerFound = true
    })
    if (!winnerFound) err.push("winner " + attr.winner + " not found in players")
    if(err.length) return err  // checkpoint
  }
})

const database = 'mtgatracker';
const deckCollection = 'deck';
const gameCollection = 'game';
const userCollectionCollection = 'userCollection';
const server = express();

server.use(bodyParser.json());

server.get('/games', (req, res, next) => {
  const { MONGO_URL } = req.webtaskContext.secrets;
  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    if (connectErr) return next(connectErr);
    let collection = client.db(database).collection(gameCollection)
    let cursor = collection.find({}, {limit: 5});  // hard-limit to 5 records for example
    cursor.toArray((cursorErr, docs) => {
      if (cursorErr) return next(cursorErr);
      console.log("hello daphne")
      res.status(200).send(docs);
      client.close()
    })
  })
})

server.get('/game/_id/:_id', (req, res, next) => {
  const { MONGO_URL } = req.webtaskContext.secrets;
  MongoClient.connect(MONGO_URL, (err, client) => {
    const { _id } = req.params ;
    if (err) return next(err);
    client.db(database).collection(gameCollection).findOne({ _id: new ObjectID(_id) }, (err, result) => {
      client.close();
      if (err) return next(err);
      if (result !== null) res.status(200).send(result)
      else res.status(404).send(result)
    });
  });
});

server.get('/game/gameID/:gid', (req, res, next) => {
  const { MONGO_URL } = req.webtaskContext.secrets;
  MongoClient.connect(MONGO_URL, (err, client) => {
    const gid = parseInt(req.params.gid);
    if (err) return next(err);
    client.db(database).collection(gameCollection).findOne({ gameID: gid }, null, (err, result) => {
      client.close();
      if (err) return next(err);
      if (result !== null) res.status(200).send(result)
      else res.status(404).send(result)
    });
  });
});

server.post('/game', (req, res, next) => {
  const { MONGO_URL } = req.webtaskContext.secrets;
  // Do data sanitation here.
  const model = req.body;
  let game = new Game(model)
  if (!game.isValid()) {
    res.status(400).send({error: game.validationError})
    return;
  }

  MongoClient.connect(MONGO_URL, (err, client) => {
    if (err) return next(err);
    client.db(database).collection(gameCollection).insertOne(model, (err, result) => {
      client.close();
      if (err) return next(err);
      res.status(201).send(result);
    });
  });
});
module.exports = Webtask.fromExpress(server);
