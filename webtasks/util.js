const jwt = require('jsonwebtoken')
const BluebirdPromise = require('bluebird')
const request = require('request');
const backbone = require('backbone');
import secrets from './on_demand/secrets.js'

global.Promise = BluebirdPromise

Promise.onPossiblyUnhandledRejection((e, promise) => {
    throw e
})

let Game = backbone.Model.extend({
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

var latestVersion = null;
var latestVersionString = null;
var downloadCount = null;

const deckCollection = 'deck',
      gameCollection = 'game',
      userCollection = 'user',
      errorCollection = 'error';

let routeDoc = (routeStack) => {
  let routeDoc = {}
  routeStack.forEach((route, idx) => {
    if (route.route && route.route.path != "") {
      if (!routeDoc[route.route.path]) {
        routeDoc[route.route.path] = []
      }
      routeDoc[route.route.path].push(Object.keys(route.route.methods)[0])
    }
  })
  return routeDoc;
}

let random6DigitCode = () => {
  return Math.floor(Math.random()*900000) + 100000;
}

let createToken = (username) => {
  return jwt.sign({"user": username}, secrets.jwtSecret, {expiresIn: "7d"})
}

let createAnonymousToken = () => {
  return jwt.sign({"user": null, "anonymousClientID": random6DigitCode()}, secrets.jwtSecret, {expiresIn: "1d"})
}

let getCookieToken = (req) => {
  console.log("get cookie token")
  if (req.headers.cookie && req.headers.cookie.split('=')[0] === 'access_token') {
    console.log("from cookie")
    return req.headers.cookie.split('=')[1];
  } else if (req.query && req.query.token) {
    console.log("from query.token")
    return req.query.token;
  } else if (req.headers && req.headers.token) {
    console.log("from query.headers.token")
    return req.headers.token;
  } else if (req.headers && req.headers.Authorization && req.headers.Authorization.split(" ")[0] === "access_token") {
    console.log("from query.headers.Authorization[access_token]")
    return req.headers.Authorization.split(" ")[1];
  }
  console.log("none, null :(")
  return null;
}

let sendDiscordMessage = (message, webhook_url, silent) => {
  return new Promise((resolve, reject) => {
    if (silent) {
      resolve({ok: true})
    } else {
      request.post({
        url: webhook_url,
        body: {
          "content": message
          },
        json: true,
        headers: {'User-Agent': 'MTGATracker-Webtask'}
      }, (err, reqRes, data) => {
        if (err) reject(err)
        resolve({ok: true})
      })
    }
  })
}

let getGameById = (client, database, gameID, callback) => {
  return new Promise((resolve, reject) => {
    console.log("getGameById " +  gameID)
    client.db(database).collection(gameCollection).findOne({ gameID: gameID }, null, function(err, result) {
      if (err) { reject() } else { resolve() }
      callback(result, err)
    })
  })
}

let logError = (client, database, error, callback) => {
  client.db(database).collection(errorCollection).insertOne(error, null, (err, result) => {
    callback(result, err)
  })
}

let parseVersionString = (versionStr) => {
  let version = {}
  let version_parts = versionStr.split("-")
  if (version_parts.length > 1)
    version.suffix = version_parts[1]
  let version_bits = version_parts[0].split(".")
  version.major = version_bits[0]
  version.medium = version_bits[1]
  version.minor = version_bits[2]
  return version;
}

let differenceMinutes = (date1, date2) => {
  return (date2 - date1) * 1.66667e-5
}

let getGithubStats = (storage) => {
  return new Promise((resolve, reject) => {
    storage.get((err, data) => {
      // github rate limits are 1/min for unauthed requests, only allow every 1.5 min to be safe
      if (data === undefined || differenceMinutes(data.lastUpdated, Date.now()) >= 1.5) {
        let setTime = Date.now()
        if (data !== undefined && data.lastUpdated !== undefined)
          console.log("need to request gh api (has been " + differenceMinutes(data.lastUpdated, Date.now()) + " minutes)")
        else
          console.log("need to request gh data (cache is empty)")
        request.get({
          url: "https://api.github.com/repos/shawkinsl/mtga-tracker/releases",
          json: true,
          headers: {'User-Agent': 'MTGATracker-Webtask'}
        }, (err, res, data) => {
          if (err || (typeof data === 'object' && !(data instanceof Array))) {
            console.log("greppable: gh data was not array and was object")
            let fakeVersionStr = "1.1.1-beta"
            let fakedData = {latestVersion: parseVersionString(fakeVersionStr), latestVersionString: latestVersionString, totalDownloads: 100, lastUpdated: new Date(), warning: "Warning: this is fake data!"}
            storage.set(fakedData, (err) => {})
            resolve(fakedData)
          } else {
            let downloadCount = 0;
            data.forEach((elem, idx) => {
                elem.assets.forEach((asset, idx) => {
                    downloadCount += asset.download_count;
                })
            })
            latestVersionString = data[0].tag_name
            latestVersion = parseVersionString(latestVersionString);
            data = {latestVersion: latestVersion, latestVersionString: latestVersionString, totalDownloads: downloadCount, lastUpdated: setTime}
            storage.set(data, (err) => {})
            resolve(data)
          }
        })
      } else {
        resolve(data)
      }
    })
  })
}

  // TODO: DRY here and @ electron/renderer.js ?
let clientVersionUpToDate = (clientVersion, storage) => {
  return new Promise((resolve, reject) => {
    // check for a newer release, (but only once, don't want to hit github a million times)
    getGithubStats(storage).then(latestVersionObj => {
      let { latestVersion, latestVersionString } = latestVersionObj
      if (clientVersion === undefined) {
        resolve({ok: false, latest: latestVersion})
      } else {
        let appVersion = parseVersionString(clientVersion);
        let ok = false;
        if (appVersion != latestVersion) {
          // https://github.com/shawkinsl/mtga-tracker/issues/129
          if (appVersion.major != latestVersion.major || appVersion.medium != latestVersion.medium) {
            ok = false;
          } else if (latestVersion.suffix === undefined && appVersion.suffix !== undefined) {
            // client is x.y.z-beta, latest is x.y.z
            ok = false;
          } else {
            ok = true;
          }
        }
        resolve({ok: ok, latest: latestVersionString})
      }
    })
  })
}

let randomString = () => {
  return Math.random().toString(36).substr(2, 5) + Math.random().toString(36).substr(2, 5) + Math.random().toString(36).substr(2, 5)
}

let getPublicName = (client, database, username, createIfDoesntExist, isUser) => {
  console.log("getPublicName")
  if (createIfDoesntExist === undefined) {
    createIfDoesntExist = false;
  }
  if (isUser === undefined) {
    isUser = false;
  }
  return new Promise((resolve, reject) => {
    client.db(database).collection(userCollection).findOne({username: username}, null, function(err, result) {
      if (!createIfDoesntExist || result) {
        if (isUser) {
          result.isUser = true;
          client.db(database).collection(userCollection).save(result)
        }
        resolve({error: err, result: result})
      } else {
        // we need to make one if there isn't one available
        client.db(database).collection(userCollection).findOne({available: true}, null, (err, result) => {
          if (result) {
            result.available = false
            result.username = username
            result.isUser = (isUser ? true : false);  // filter out any weird values that come in
            client.db(database).collection(userCollection).save(result)
            resolve({err: null, result: result})
          } else {
            // handle case where there are none available
            let pubname = randomString()
            let newResult = {
              available: false,
              username: username,
              publicName: pubname,
              isUser: (isUser ? true : false)
            }
            client.db(database).collection(userCollection).insertOne(newResult, null, (err, result) => {
              resolve({err: null, result: result})
            })
          }
        })
      }
    })
  })
}


module.exports = {
  getPublicName: getPublicName,
  randomString: randomString,
  clientVersionUpToDate: clientVersionUpToDate,
  getGithubStats: getGithubStats,
  differenceMinutes: differenceMinutes,
  parseVersionString: parseVersionString,
  logError: logError,
  getGameById: getGameById,
  sendDiscordMessage: sendDiscordMessage,
  getCookieToken: getCookieToken,
  createAnonymousToken: createAnonymousToken,
  createToken: createToken,
  random6DigitCode: random6DigitCode,
  routeDoc: routeDoc,
  deckCollection: deckCollection,
  gameCollection: gameCollection,
  userCollection: userCollection,
  errorCollection: errorCollection,
  Game: Game
}
