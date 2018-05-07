'use latest';

import bodyParser from 'body-parser';
import express from 'express';
import Webtask from 'webtask-tools';
import { MongoClient, ObjectID } from 'mongodb';

const ejwt = require('express-jwt');

var secrets; // babel makes it so we can't const this, I am pretty sure
try {
  secrets = require('./secrets.js')
} catch (e) {
  secrets = require('./secrets-template.js')
}

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
  errorCollection
} = require('../util')

const BluebirdPromise = require('bluebird')
global.Promise = BluebirdPromise
Promise.onPossiblyUnhandledRejection((e, promise) => {
    throw e
})

const server = express();

server.use(bodyParser.json());

const publicAPI = require('./api/public-api')
const anonAPI = require('./api/anon-api')
const userAPI = require('./api/user-api')
const adminAPI = require('./api/admin-api')

let userIsAdmin = (req, res, next) => {
  if (req.user.user == "Spencatro") {
    next()
  } else {
    res.status(400).send({"error": "you are not an admin, sorry :'("})
  }
}

let userUpToDate = (req, res, next) => {
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;

  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    const { user } = req.user;
    if (connectErr) return next(connectErr);
    let collection = client.db(DATABASE).collection(gameCollection)
    let cursor = collection.find({'hero': user}).sort({date: -1});
    cursor.next((err, doc) => {
      if (doc.clientVersionOK) next()
      else {
       res.status(400).send({"error": "your account has been locked"})
      }
    })
  })
}

function ejwt_wrapper(req, res, next) {
  return ejwt({ secret: req.webtaskContext.secrets.JWT_SECRET, getToken: getCookieToken })
    (req, res, next);
}

server.use('/public-api', publicAPI)
server.use('/anon-api', ejwt_wrapper, anonAPI)
server.use('/api', ejwt_wrapper, userUpToDate, userAPI)
server.use('/admin-api', ejwt_wrapper, userIsAdmin, adminAPI)

server.get('/', (req, res, next) => {
  res.status(200).send({
    "/public-api": routeDoc(publicAPI.stack),
    "/anon-api": routeDoc(anonAPI.stack),
    "/api": routeDoc(userAPI.stack),
  })
})

// no cover - not testable?
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
