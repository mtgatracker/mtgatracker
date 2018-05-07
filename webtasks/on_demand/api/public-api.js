'use latest';

const express = require('express'),
      router = express.Router();
const { MongoClient, ObjectID } = require('mongodb');
const {
  createAnonymousToken,
  createToken,
  random6DigitCode,
  routeDoc,
  sendDiscordMessage,
  userCollection,
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

// covered: test_get_anon_token
router.get('/anon-api-token', (req, res, next) => {
  console.log("/public-api/anon-api-token")
  let token = createAnonymousToken(req.webtaskContext.secrets.JWT_SECRET)
  let dayMs = 1 * 24 * 60 * 60 * 1000;
  let cookieExpiration = new Date()
  cookieExpiration.setTime(cookieExpiration.getTime() + dayMs)
  res.cookie('access_token', token, {secure: true, expires: cookieExpiration})
  res.status(200).send({token: token})
})

// covered: test_get_user_token
router.post('/auth-attempt', (req, res, next) => {
  console.log('/auth-attempt')
  const authRequest = req.body;

  const { username, accessCode } = authRequest;
  const { MONGO_URL, DATABASE, DISCORD_WEBHOOK } = req.webtaskContext.secrets;

  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    let users = client.db(DATABASE).collection(userCollection);

    let usernameRegexp = new RegExp(`^${username}$`, "i")
    let userSearch = {username: {$regex: usernameRegexp}}

    users.findOne(userSearch, null, (err, result) => {
      if (result === undefined || result === null) {
        res.status(404).send({"error": "no user found with username " + username})
        return
      }

      let expireCheck = new Date()
      if (result.auth !== undefined && result.auth !== null && result.auth.expires > expireCheck
          && result.auth.accessCode == accessCode) {
            let token = createToken(username, req.webtaskContext.secrets.JWT_SECRET)
            let weekMs = 7 * 24 * 60 * 60 * 1000;
            let cookieExpiration = new Date()
            cookieExpiration.setTime(cookieExpiration.getTime() + weekMs)
            res.cookie('access_token', token, {secure: true, expires: cookieExpiration})

            // reset token now
            let expiresDate = new Date()
            expiresDate.setHours(expiresDate.getHours() + 6)
            let newAuthObj = {
              expires: expiresDate,
              accessCode: random6DigitCode()
            }
            users.update({'username': result.username}, {$set: {auth: newAuthObj}}, (err, mongoRes) => {
              res.status(200).send({token: token})
            })
      } else {
        res.status(400).send({"error": "auth_error"})
      }
    })
  })
})

// covered: test_get_user_token
router.post('/auth-request', (req, res, next) => {
  console.log('/user/auth-request')
  const authRequest = req.body;

  const { username, silent } = authRequest;

  const { MONGO_URL, DATABASE, DISCORD_WEBHOOK } = req.webtaskContext.secrets;

  if (username === undefined || username === null) {
    res.status(400).send({"error": "invalid request"})
    return
  }

  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    let users = client.db(DATABASE).collection(userCollection);

    let usernameRegexp = new RegExp(`^${username}$`, "i")
    let userSearch = {username: {$regex: usernameRegexp}}

    users.findOne(userSearch, null, (err, result) => {
      if (result === undefined || result === null) {
        res.status(404).send({"error": "no user found with username " + username})
        return
      }

      if (result.discordUsername === undefined || result.discordUsername === null) {
        res.status(404).send({"error": "discord mapping not found for " + username})
        return
      }

      // if the current code expires in less than 30 seconds, let's refresh
      let expireCheck = new Date()
      expireCheck.setSeconds(expireCheck.getSeconds() + 30)
      if (result.auth !== undefined && result.auth !== null && result.auth.expires > expireCheck) {
        // this code is still ok; you have >30s to put it in
        let authObj = result.auth;
        let msgUsername = result.discordUsername ? "Discord:" + result.discordUsername : "MTGA:" + username;
        let msg = msgUsername + "/" + authObj.accessCode + "/expires @ " + authObj.expires.toLocaleString("en-US", {timeZone: "America/Los_Angeles"})
        sendDiscordMessage(msg, DISCORD_WEBHOOK, silent).then(() => {
          res.status(200).send({"request": "sent", "username": result.username})
        })
      } else {
        // this code will expire in less than 30s; we will just make you a new one.
        let expiresDate = new Date()
        expiresDate.setMinutes(expiresDate.getMinutes() + 2)
        let newAuthObj = {
          expires: expiresDate,
          accessCode: random6DigitCode()
        }
        users.update({'username': result.username}, {$set: {auth: newAuthObj}}, (err, mongoRes) => {
          console.log(mongoRes.result.nModified)
          if (silent != true) {
            let msgUsername = result.discordUsername ? "Discord:" + result.discordUsername : "MTGA:" + username;
            let msg = msgUsername + "/" + newAuthObj.accessCode + "/expires @ " + newAuthObj.expires.toLocaleString("en-US", {timeZone: "America/Los_Angeles"})

            sendDiscordMessage(msg, DISCORD_WEBHOOK, silent).then(() => {
              res.status(200).send({"request": "sent", "username": result.username})
            })
          } else {
            res.status(200).send({"request": "sent", "username": result.username})
          }
        })
      }
    })
  })
})

module.exports = router