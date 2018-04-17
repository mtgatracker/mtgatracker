'use latest';

import bodyParser from 'body-parser';
import express from 'express';
import Webtask from 'webtask-tools';
import { MongoClient, ObjectID } from 'mongodb';

const BluebirdPromise = require('bluebird')
global.Promise = BluebirdPromise
Promise.onPossiblyUnhandledRejection((e, promise) => {
    throw e
})

const deckCollection = 'deck';
const gameCollection = 'game';
const userCollection = 'user';
const errorCollection = 'error';
const server = express();

server.use(bodyParser.json());

// covered: test_cron_fixes_hero_in_schema0
let cleanHeroes = (collection, callback) => {
  return new Promise((resolve, reject) => {
    console.log("enter cleanHeroes")
    let noHeroDefinedCursor = collection.find({hero: {$exists: false}}).limit(100)
    let errors = []
    let updated = 0;
    noHeroDefinedCursor.toArray((cursorErr, docs) => {
      docs.forEach((doc, idx) => {
        updated += 1
        try{
          if (doc.players[0].deck.poolName.includes("visible cards") && !doc.players[1].deck.poolName.includes("visible cards")) {
            doc.hero = doc.players[1].name;
            doc.opponent = doc.players[0].name;
            collection.save(doc)
          } else if (doc.players[1].deck.poolName.includes("visible cards") && !doc.players[0].deck.poolName.includes("visible cards")) {
            doc.hero = doc.players[0].name;
            doc.opponent = doc.players[1].name;
            collection.save(doc)
          } else {
            updated -= 1;
            errors.push({error: "could not determine hero for " + doc._id})
          }
        } catch(err) {
            updated -= 1;
            errors.push({error: "invalid record @ " + doc._id})
            console.log("ERROR: invalid record @ " + doc._id)
        }
      })
      resolve({errors: errors, cleaned: updated})
    })
  })
}

// TODO uncovered
server.post('/', (req, res, next) => {
  console.log("/ called, running scheduled tasks")
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;

  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    if (connectErr) return next(connectErr);
    let collection = client.db(DATABASE).collection(gameCollection)
    cleanHeroes(collection).then((cleanHeroesResult) => {
      const { errors, cleaned } = cleanHeroesResult
      if (errors.length > 0) {
        res.status(418).send({errors: errors, cleaned: cleaned})
      } else {
        res.status(200).send({cleaned: cleaned})
      }
    })
  })
})

module.exports = Webtask.fromExpress(server);