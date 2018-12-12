/* FETCH EXAMPLE
    let fetchURL = `insp://my-cool/endpoint`
    fetch(fetchURL)
      .then(resp => resp.json())
      .then(data => {
        console.log(`got ${data} from my-cool/endpoint`)
      })
      .catch(err => {
        console.log(err)
        alert(err)
      })
*/

var { rendererPreload } = require('electron-routes');

rendererPreload();

var getGame = function(gameID) {
  console.log(`getting: ${gameID}`)
  return new Promise((resolve, reject) => {
    $(".game-loading").css("display", "block")
    $(".export-button").prop('disabled', true);

    fetch(`insp://game/${gameID}`)
      .then(resp => resp.json())
      .then(data => {
        $(".game-loading").css("display", "none")
        $(".export-button").prop('disabled', false);
        resolve(data)
      })
      .catch(err => {
        console.log(err)
        alert(err)
        $(".game-loading").css("display", "none")
        reject(err)
      })
  })
}

var getDraft = function(draftID) {
  return new Promise((resolve, reject) => {
    $(".draft-loading").css("display", "block")
    fetch(`insp://draft/${draftID}`)
      .then(resp => resp.json())
      .then(data => {
        $(".draft-loading").css("display", "none")
        $(".export-button").prop('disabled', false);
        resolve(data)
      })
      .catch(err => {
        console.log(err)
        alert(err)
        $(".game-loading").css("display", "none")
        reject(err)
      })
  })
}

var getDeckWinLossByColor = function(deckID) {
  return new Promise((resolve, reject) => {
    if (appData.winLossColorChart) {
      for (idx = 0; idx < 5; idx++) {
        appData.winLossColorChart.data.datasets[0].data[idx] = 0
      }
      appData.winLossColorChart.update()
    }
    $("#matchup-loading").css("display", "block")

    let fetchURL = `insp://deck/${deckID}/winloss-colors`

    fetch(fetchURL)
      .then(resp => resp.json())
      .then(data => {
        $("#matchup-loading").css("display", "none")
        appData.winLossColors = [
          data.Green.wins / data.Green.total,
          data.Blue.wins / data.Blue.total,
          data.Red.wins / data.Red.total,
          data.White.wins / data.White.total,
          data.Black.wins / data.Black.total
        ]
        resolve(appData.winLossColors)
      })
      .catch(err => {
        $("#matchup-loading").css("display", "none")
        console.log(err)
        alert(err)
        reject(err)
      })
  })
}

var getPlayerEventHistory = function() {
  return new Promise((resolve, reject) => {
    $("#event-usage-loading").css("display", "block")

    let fetchURL = `insp://event-history`

    fetch(fetchURL)
      .then(resp => resp.json())
      .then(data => {
        $("#event-usage-loading").css("display", "none")
        appData.playerEventHistoryData = data
        resolve(appData.playerEventHistoryData)
      })
      .catch(err => {
        $("#event-usage-loading").css("display", "none")
        console.log(err)
        alert(err)
        reject(err)
      })
  })
}

var getDeckCount = function() {
  let fetchURL = `insp://count/decks`
  fetch(fetchURL)
    .then(resp => resp.json())
    .then(data => {
      appData.totalDecks = data.numDecks;
    })
    .catch(err => {
      console.log(err)
      alert(err)
    })
}

var getTimeStats = function() {
  let fetchURL = `insp://time-stats`
  fetch(fetchURL)
    .then(resp => resp.json())
    .then(data => {
      $("#player-stats-loading").css("display", "none")
      appData.totalTimeSeconds = data.timeStats.totalTimeSeconds;
      appData.longestGameLengthSeconds = data.timeStats.maxTimeSeconds;
      appData.averageGameLengthSeconds = data.timeStats.avgTimeSeconds;
    })
    .catch(err => {
      console.log(err)
      alert(err)
    })
}

var getOverallWinLoss = function() {
  return new Promise((resolve, reject) => {
    $("#overall-wl-loading").css("display", "block")

    let fetchURL = `insp://win-loss`

    fetch(fetchURL)
      .then(resp => resp.json())
      .then(data => {
        $("#overall-wl-loading").css("display", "none")
        appData.overallWinLoss = [
          data.wins,
          data.losses
        ]
        appData.totalGamesPlayed = data.wins + data.losses;
        resolve(appData.overallWinLoss)
      })
      .catch(err => {
        $("#overall-wl-loading").css("display", "none")
        console.log(err)
        alert(err)
        reject(err)
      })
  })
}


var getOverallWinLossByEvent = function() {
  return new Promise((resolve, reject) => {
    if (appData.overallWinLossByEventChart) {
      appData.overallWinLossByEventChart.data.datasets[0].data[0] = 0
      appData.overallWinLossByEventChart.data.datasets[1].data[0] = 0
      appData.overallWinLossByEventChart.update()
    }
    $("#overall-wl-by-event-loading").css("display", "block")

    let fetchURL = `insp://win-loss/by-event`

    fetch(fetchURL)
      .then(resp => resp.json())
      .then(data => {
        $("#overall-wl-by-event-loading").css("display", "none")
        appData.overallWinLossByEvent = data.eventCounts
        resolve(appData.overallWinLossByEvent)
      })
      .catch(err => {
        $("#overall-wl-loading").css("display", "none")
        console.log(err)
        alert(err)
        reject(err)
      })

  })
}

var getDrafts = function(perPage) {
  if (perPage === undefined) {
    perPage = 10;
  }
  $("#drafts-loading").css("display", "block")

  fetch(`insp://drafts/${perPage}`)
    .then(resp => resp.json())
    .then(data => {
      $("#drafts-loading").css("display", "none")
      appData.homeDraftList = []
      $.each(data.drafts, function(key, value) {
        value.link = `/draft/?draftID=${value._id}`
        value.draftName = value.draftID.split(':')[1]
        let draftNameSplit = value.draftName.split("_")
        if (draftNameSplit.length == 3) {  // for drafts like QuickDraft_M19_08262018 => M19
          value.draftName = draftNameSplit[1] + " " + draftNameSplit[0]
        }
        value.timeago = timeago().format(value.date)
        appData.homeDraftList.push(value)
      })
    }).catch (err => {
      alert(err)
      console.log(err)
      $("#drafts-loading").css("display", "none")
    })
}

/*
Story time!

I decided to see how NeDB does with a crazy amount of data, so I generated about 10k worth of game data (based on
mutated copies real production data). This lead to about 750 unique decks. HOO BOY is rivets stupid slow!
With about 750ish deck to insert in to the DOM, rivets completely HANGS the UI for like, 20 seconds. It's ridiculous!
You can reproduce this yourself if you want to by inserting a similar amount of data into your DB, and
changing the upper limit of the slice in this function to 700ish. Besides this issue, NeDB works great.
(and that's not even an NeDB issue!)

G2H, rivets.
*/
var renderMoreDecks = function() {
  for (let deck of appData.fullHomeDeckList.slice(appData.homeDeckOffset, appData.homeDeckOffset+50)) {
    appData.homeDeckList.push(deck)
  }
  appData.homeDeckOffset += 50
  appData.moreDecksToRender = appData.homeDeckOffset < appData.fullHomeDeckList.length
}
window.renderMoreDecks = renderMoreDecks

var getDecks = function(includeHidden) {
  $("#decks-loading").css("display", "block")

  fetch(`insp://decks/${includeHidden}`)
    .then(resp => resp.json())
    .then(data => {
      $("#decks-loading").css("display", "none")
      appData.homeDeckOffset = 0
      appData.fullHomeDeckList = []
      appData.homeDeckList = []
      for (let deck of data.decks) {
        deck.link = `/deck/?deckID=${deck.deckID}`
        appData.fullHomeDeckList.push(deck)
        deck.winrate = ((deck.wins / (deck.wins + deck.losses)) * 100).toFixed(0)
      }
      renderMoreDecks()
    }).catch(err => {
      alert(err)
      console.log(err)
    })
}

var hideDeck = function(deckID, button) {
  if (button) {
    $(button).prop('disabled', true);
  }
  console.log("hideDeck called")
  let fetchURL = `insp://deck/${deckID}/hide`
  fetch(fetchURL)
    .then(resp => resp.json())
    .then(data => {
      if (button) {
        $(button).prop('disabled', false);
      }
      console.log("success, hidden")
      appData.homeDeckList.forEach(deck => {
        if (deck.deckID == deckID) {
          deck.hidden = true;
        }
      })
    })
    .catch(err => {
      if (button) {
        $(button).prop('disabled', false);
      }
      console.log("err didn't hide :(")
      console.log(err)
      alert(err)
    })
}

var unHideDeck = function(deckID, button) {
  if (button) {
    $(button).prop('disabled', true);
  }
  console.log("unhideDeck called")
  let fetchURL = `insp://deck/${deckID}/unhide`
  fetch(fetchURL)
    .then(resp => resp.json())
    .then(data => {
      if (button) {
        $(button).prop('disabled', false);
      }
      console.log("success, unhidden")
      appData.homeDeckList.forEach(deck => {
        if (deck.deckID == deckID) {
          deck.hidden = false;
        }
      })
    })
    .catch(err => {
      if (button) {
        $(button).prop('disabled', false);
      }
      console.log("err didn't unhide :(")
      console.log(err)
      alert(err)
    })
}

var getGames = function(page, opts) {
  console.log("getting games... " + JSON.stringify(opts))
  $("#more-games-button").removeClass("btn-info").addClass("btn-primary").val("Loading games...").prop('disabled', true)
  appData.homeGameListPage += 1;
  if (page === undefined) page = 1;


  if (opts && opts.removeOld)
    appData.homeGameList = []

  // HACK: electron router won't recognize "game//page=2" for "game/:query/page=2" , so stuff
  // a fake query if no opts defined
  let query = "query=none"

  if (opts) query = Object.keys(opts).map(key => `${key}=${opts[key]}`).join("&")
  let url = `insp://games/${query}/page=${page}`

  fetch(url)
    .then(resp => resp.json())
    .then(data => {
      if(data.totalPages > page) {
        $("#more-games-button").removeClass("btn-primary").addClass("btn-info").val(`Load more (${page}/${data.totalPages})`).prop('disabled', false)
      } else {
        $("#more-games-button").removeClass("btn-info").addClass("btn-primary").val("No more to load!").prop('disabled', true)
      }
      $("#timeline-loading").css("display", "none")
      if (opts && opts.setCurrentDeckName)
        appData.currentDeckName = data.docs[0].players[0].deck.poolName
      appData.username = data.docs[0].hero
      $.each(data.docs, function(idx, val) {
        let heroColors = cardUtils.cardsColors(Object.keys(val.players[0].deck.cards).map(x => parseInt(x, 10)))
        let opponentColors = cardUtils.cardsColors(Object.keys(val.players[1].deck.cards).map(x => parseInt(x, 10)))
        Promise.all([heroColors, opponentColors]).then(res => {
          let newVal = {}
          newVal.hero = val.hero
          newVal.heroDeck = val.players[0].deck.cards
          newVal.heroDeckColors = res[0]
          newVal.opponent = val.opponent
          newVal.opponentDeck = val.players[1].deck.cards
          newVal.heroDeckName = val.players[0].deck.poolName
          newVal.deckLink = `/deck/?deckID=${val.players[0].deck.deckID}`
          newVal.opponentDeckName = val.players[1].deck.poolName
          newVal.opponentDeckColors = res[1]
          newVal.timeago = timeago().format(val.date)
          newVal.won = val.winner == val.hero
          newVal.link = `/game/?gameID=${val._id}`
          newVal.winner = val.winner

          appData.homeGameList.push(newVal)
        })
      })
    }).catch(err => {
      console.log(err)
      alert(err)
      $("#timeline-loading").css("display", "none")
    })
}

module.exports = {
  getDecks: getDecks,
  getGames: getGames,
  getDeckWinLossByColor: getDeckWinLossByColor,
  getGame: getGame,
  hideDeck: hideDeck,
  unHideDeck: unHideDeck,
  getDraft: getDraft,
  getDrafts: getDrafts,
  getOverallWinLoss: getOverallWinLoss,
  getOverallWinLossByEvent: getOverallWinLossByEvent,
  getPlayerEventHistory: getPlayerEventHistory,
  getDeckCount: getDeckCount,
  getTimeStats: getTimeStats,
}
