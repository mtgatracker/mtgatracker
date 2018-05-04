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

// covered: test_game_histogram_...
router.get('/games/time-histogram', (req, res, next) => {
  console.log("GET /games/time-histogram")
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;
  let { sample_size, min_date, max_date } = req.query;
  if (min_date === undefined) {
    let weekMs = 7 * 24 * 60 * 60 * 1000;
    min_date = new Date()
    min_date.setTime(min_date.getTime() - weekMs)
  }
  if (max_date === undefined) {
    max_date = new Date()
  }
  if (sample_size === undefined) {
    sample_size = 100;
  }

  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    if (connectErr) return next(connectErr);
    let collection = client.db(DATABASE).collection(gameCollection)

    collection.count({date: {$lt: min_date}}, null, (err, startCount) => {
      if (err) return next(err);
      let cursor = collection.find({date: {$gt: min_date, $lt: max_date}}, null)
      cursor.count(null, null, (err, sampleCount) => {
        let skip = Math.max(1, Math.round(sampleCount / sample_size))
        cursor.sort({date: 1})
        cursor.toArray((cursorErr, docs) => {
          let resultDocs = []
          let currentCount = startCount
          docs.forEach((doc, idx) => {
            currentCount += 1
            if (idx % skip == 0 || idx == docs.length - 1) {
              resultDocs.push({date: doc.date, count: currentCount})
            }
          })
          if (resultDocs.length > sample_size) {
            resultDocs.splice(0, resultDocs.length - sample_size)
          }
          res.status(200).send({
            game_histogram: resultDocs,
            startCount: startCount,
            docLength: docs.length,
            sampleCount: sampleCount
          });
          client.close()
        })
      })
    })
  })
})


// covered: test_hero_histogram_one_per
router.get('/heroes/time-histogram', (req, res, next) => {
  console.log("GET /heroes/time-histogram")
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;
  let { sample_size, min_date, max_date } = req.query;
  if (min_date === undefined) {
    let weekMs = 7 * 24 * 60 * 60 * 1000;
    min_date = new Date()
    min_date.setTime(min_date.getTime() - weekMs)
  }
  if (max_date === undefined) {
    max_date = new Date()
  }
  if (sample_size === undefined) {
    sample_size = 100;
  }

  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    if (connectErr) return next(connectErr);
    let collection = client.db(DATABASE).collection(gameCollection)
    collection.distinct('hero', {date: {$lt: min_date}}, null, (err, distinctHeroesBefore) => {
      if (err) return next(err);

      let distinctHeroesSet = new Set(distinctHeroesBefore)
      let beforeCount = distinctHeroesSet.size;

      console.log(distinctHeroesSet)

      let cursor = collection.find({date: {$gt: min_date, $lt: max_date}}, null)
      collection.distinct('hero', {date: {$gt: min_date, $lt: max_date}}, null, (err, distinctHeroesAfter) => {

        console.log(distinctHeroesAfter)
        let distinctHeroesAfterSet = new Set(distinctHeroesAfter)
        let distinctHeroesCombined = new Set([...distinctHeroesAfterSet, ...distinctHeroesSet])
        const setDifference = (a, b) => new Set([...a].filter(x => !b.has(x)));
        let distinctHeroesAfterMinusBefore = setDifference(distinctHeroesCombined, distinctHeroesSet)
        let totalCountAfter = distinctHeroesAfterMinusBefore.size;

        let distinctHeroesAfterCount = distinctHeroesAfterMinusBefore.size;
        let skip = Math.max(1, Math.round(totalCountAfter / sample_size))
        cursor.sort({date: 1})
        cursor.toArray((cursorErr, docs) => {
          let resultDocs = []
          let currentCount = beforeCount

          docs.forEach((doc, idx) => {
            if (!distinctHeroesSet.has(doc.hero)) {
              currentCount += 1
              if (idx % skip == 0 || idx == docs.length - 1) {
                resultDocs.push({date: doc.date, count: currentCount})
              }
              distinctHeroesSet.add(doc.hero)
            }
          })
          if (resultDocs.length > sample_size) {
            resultDocs.splice(0, resultDocs.length - sample_size)
          }
          res.status(200).send({
            hero_histogram: resultDocs,
            startCount: beforeCount,
            sampleCount: totalCountAfter
          });
          client.close()
        })
      })
    })
  })
})

// covered: test_speeds
router.get('/speeds', (req, res, next) => {
  console.log("/speeds")
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;

  let weekMs = 7 * 24 * 60 * 60 * 1000;
  let weekFromNow = new Date()
  weekFromNow.setTime(weekFromNow.getTime() - weekMs)

  const { min_date=weekFromNow, max_date=new Date() } = req.query;

  let dateQ = {date: {$gt: min_date, $lt: max_date}}

  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    if (connectErr) return next(connectErr);
    let collection = client.db(DATABASE).collection(gameCollection)
    collection.count(dateQ, null, (countErr, count) => {
      if (countErr) return next(countErr);

      collection.distinct("hero", null, null, (distinctErr, distinctHeroes) => {

        getGithubStats(req.webtaskContext.storage).then((githubStats) => {
          let firstReleaseDate = new Date("March 22, 2018")
          let today = new Date()
          let oneDay = 24*60*60*1000; // hours*minutes*seconds*milliseconds
          let daysDiff = Math.round(Math.abs((today.getTime() - firstReleaseDate.getTime())/(oneDay)));
          res.status(200).send({
            game_speed_per_day: count / 7.0,
            hero_speed_per_day: distinctHeroes.length / 7.0,
            download_speed_per_day: githubStats.totalDownloads / daysDiff,
          });
          client.close()
        })
      })
    })
  })
})



// covered: test_games_count
router.get('/games/count', (req, res, next) => {
  console.log("/games/count")
  const { MONGO_URL, DATABASE } = req.webtaskContext.secrets;
  const { badge } = req.query;
  MongoClient.connect(MONGO_URL, (connectErr, client) => {
    if (connectErr) return next(connectErr);
    let collection = client.db(DATABASE).collection(gameCollection)
    collection.count(null, null, (countErr, count) => {
      if (countErr) return next(countErr);
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

    collection.distinct("hero", null, null, (error, distinctHeroes) => {
      if (error) return next(error);
      let count = distinctHeroes.length;
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
    model.date = new Date()
  } else {
    model.date = new Date(Date.parse(model.date))
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