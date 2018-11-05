console.time('init')

const request = require("request")
const crypto = require("crypto")
const ReconnectingWebSocket = require('./vendor/rws.js')
const fs = require('fs')
const jwt = require('jsonwebtoken')
const Timer = require('easytimer.js');
const keytar = require('keytar')
const hideWindowManager = require("./hide-manager")

const { remote, ipcRenderer, shell } = require('electron')
const { Menu, MenuItem } = remote
let browserWindow = remote.getCurrentWindow()
const activeWin = require("active-win")

// poll for active window semi-regularly; if it's not MTGA or MTGATracker, minimize / unset alwaysontop
setInterval(() => {
  if (appData.mtgaOverlayOnly) {
    activeWin().then(win => {
      if (win.owner.name == "MTGA.exe" || win.owner.name == "MTGATracker.exe" || win.title == "MTGA Tracker") {
        if(!browserWindow.isAlwaysOnTop()) browserWindow.setAlwaysOnTop(true)
      } else {
        if(browserWindow.isAlwaysOnTop()) browserWindow.setAlwaysOnTop(false)
      }
    })
  } else {
    console.log("skipping overlay check and turning on always on top")
    if(!browserWindow.isAlwaysOnTop()) browserWindow.setAlwaysOnTop(true)
  }
}, 200)

window.addEventListener('beforeunload', function() {
    ws.send("die")
})

let rightClickPosition = null

const menu = new Menu()
const menuItem = new MenuItem({
  label: 'Inspect Element',
  click: () => {
    remote.getCurrentWindow().inspectElement(rightClickPosition.x, rightClickPosition.y)
  }
})
menu.append(menuItem)

const API_URL = remote.getGlobal('API_URL');

var lastUsedUsername = null;

var debug = remote.getGlobal('debug');
var useFrame = remote.getGlobal('useFrame');
var staticMode = remote.getGlobal('staticMode');
var showIIDs = remote.getGlobal('showIIDs');
var showErrors = remote.getGlobal('showErrors');
var appVersionStr = remote.getGlobal('version');
var runFromSource = remote.getGlobal('runFromSource');
var showTotalWinLossCounter = remote.getGlobal('showTotalWinLossCounter');
var showDeckWinLossCounter = remote.getGlobal('showDeckWinLossCounter');
var showVaultProgress = remote.getGlobal('showVaultProgress');
var lastCollection = remote.getGlobal('lastCollection');
var lastVaultProgress = remote.getGlobal('lastVaultProgress');
var minVaultProgress = remote.getGlobal('minVaultProgress');
var sortMethod = remote.getGlobal('sortMethod');
var showChessTimers = remote.getGlobal('showChessTimers');
var hideDelay = remote.getGlobal('hideDelay');
var invertHideMode = remote.getGlobal('invertHideMode');
var rollupMode = remote.getGlobal('rollupMode');
var recentCardsQuantityToShow = remote.getGlobal('recentCardsQuantityToShow');
var showGameTimer = remote.getGlobal('showGameTimer');
var zoom = remote.getGlobal('zoom');
var recentCards = remote.getGlobal('recentCards');
var port = remote.getGlobal('port');
var timerRunning = false;
var uploadDelay = 0;
var hideModeManager;

setInterval(() => {
  uploadDelay -= 1
  if (uploadDelay < 0) uploadDelay = 0;
}, 200)

var lastUseTheme = remote.getGlobal('useTheme')
var lastThemeFile = remote.getGlobal('themeFile')

var token = null;
keytar.getPassword("mtgatracker", "tracker-id-token").then(savedToken => {
  token = savedToken;
})

if (debug) {
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    rightClickPosition = {x: e.x, y: e.y}
    menu.popup(remote.getCurrentWindow())
  }, false)
}

var ws = new ReconnectingWebSocket(`ws://127.0.0.1:${port}/`, null, {constructor: WebSocket})

var gameLookup = {}
var lastGameState = null;
var resizing = false;

var overallTimer = new Timer();
var heroTimer = new Timer();
var opponentTimer = new Timer();

window.overallTimer = overallTimer
window.heroTimer = heroTimer
window.opponentTimer = opponentTimer

var winLossCounterInitial = remote.getGlobal("winLossCounter")

let getMainWindowDisplay = () => {
  let {x, y} = browserWindow.getBounds()
  let display = remote.screen.getDisplayNearestPoint({x: x, y: y})
  return display;
}

let calcMainMaxHeight = () => {
  let displayBounds = getMainWindowDisplay().bounds
  let displayY= displayBounds.y
  let displayHeight = displayBounds.height
  let windowBounds = browserWindow.getBounds()
  let windowY = windowBounds.y
  let maxHeight = displayHeight - (windowY - displayY)
  return maxHeight + 10;  // add some buffer; 10px won't hide anything
}

var appData = {
    deck_name: "loading...",
    cant_connect: false,
    showErrors: showErrors,
    last_error: "",
    error_count: 0,
    debug: debug,
    show_iids: showIIDs,
    last_connect: 0,
    last_connect_as_seconds: 0,
    lastCollection: lastCollection,
    lastVaultProgress: lastVaultProgress,
    minVaultProgress: minVaultProgress,
    game_in_progress: false,
    showDraftStats: false,
    draftStats: [],
    game_complete: false,
    game_dismissed: false,
    show_available_decklists: true,
    no_decks: false,
    no_list_selected: true,
    list_selected: false,
    selected_list_size: "0",
    selected_list: [],
    selected_list_name: "",
    player_decks: [],
    total_cards_in_deck: "0",
    draw_stats: [],
    opponent_hand: [],
    messages: [],
    version: appVersionStr,
    showTotalWinLossCounter: showTotalWinLossCounter,
    showDeckWinLossCounter: showDeckWinLossCounter,
    showVaultProgress: showVaultProgress,
    winLossObj: winLossCounterInitial,
    activeDeck: 'total',
    totalWinCounter: winLossCounterInitial['total'].win,
    totalLossCounter: winLossCounterInitial['total'].loss,
    deckWinCounter: 0,
    deckLossCounter: 0,
    showGameTimer: showGameTimer,
    showChessTimers: showChessTimers,
    hideDelay: hideDelay,
    invertHideMode: invertHideMode,
    rollupMode: rollupMode,
    recentCardsQuantityToShow: recentCardsQuantityToShow,
    recentCards: recentCards,
}

var parseVersionString = (versionStr) => {
    version = {}
    version_parts = versionStr.split("-")
    if (version_parts.length > 1)
        version.suffix = version_parts[1]
    version_bits = version_parts[0].split(".")
    version.major = version_bits[0]
    version.medium = version_bits[1]
    version.minor = version_bits[2]
    return version;
}

var addMessage = (message, link, mustfollow, messageID) => {
    if (!link) link = "#"
    let existingMessage = appData.messages.filter(x => x["text"] == message && x["show"])
    if (existingMessage.length) {
      // we can just bump the count on this one
      existingMessage[0]["count"] += 1
    } else {
      // we need a new one
      let newMessage = {text: message, count: 1, show: true}
      if (messageID) {
        newMessage["messageID"] = messageID
      }
      if (mustfollow) {
        newMessage["mustfollow"] = link
      } else {
        newMessage["mayfollow"] = link
      }
      appData.messages.push(newMessage)
    }
    resizeWindow()
}

var dismissMessage = (element) => {
   let elementIdx = element.attributes.index.value
   let messageID = false
   if (element.attributes.messageID) {
     messageID = element.attributes.messageID.value
   }
   if (messageID) {
     ipcRenderer.send('messageAcknowledged', messageID)
   }
   appData.messages[elementIdx]["show"] = false;
   resizeWindow()
}

request.get({
    url: `${API_URL}/public-api/tracker-notifications`,
    json: true,
    headers: {'User-Agent': 'MTGATracker-App'}
}, (err, res, data) => {
  if (data.notifications) {
    data.notifications.forEach(message => {
      let link = "#"
      let mustfollow = false;
      if (message.mayfollow) {
        link = message.mayfollow
      } else if (message.mustfollow) {
        link = message.mustfollow
        mustfollow = true
      }
      addMessage(message.text, link, mustfollow, message.messageID)
    })
  }
})

let cardtypeCompare = function (a, b) {
    // Creatures -> Planeswalkers -> Enchantments -> Artifacts -> Sorceries -> Instants -> Non-Basic Lands -> Basic Lands
    if (a.includes("Creature")) {
        if (!b.includes("Creature")) {
            return -1;
        }
        return 0;
    }
    if (b.includes("Creature")) {
        return 1;
    }
    if (a.includes("Planeswalker")) {
        if (!b.includes("Planeswalker")) {
            return -1;
        }
        return 0;
    }
    if (b.includes("Planeswalker")) {
        return 1;
    }
    if (a.includes("Enchantment")) {
        if (!b.includes("Enchantment")) {
            return -1;
        }
        return 0;
    }
    if (b.includes("Enchantment")) {
        return 1;
    }
    if (a.includes("Artifact")) {
        if (!b.includes("Artifact")) {
            return -1;
        }
        return 0;
    }
    if (b.includes("Artifact")) {
        return 1;
    }
    if (a.includes("Sorcery")) {
        if (!b.includes("Sorcery")) {
            return -1;
        }
        return 0;
    }
    if (b.includes("Sorcery")) {
        return 1;
    }
    if (a.includes("Instant")) {
        if (!b.includes("Instant")) {
            return -1;
        }
        return 0;
    }
    if (b.includes("Instant")) {
        return 1;
    }
    if (a.includes("Basic")) {
        if (!b.includes("Basic")) {
            return 1;
        }
        return 0;
    }
    if (b.includes("Basic")) {
        return -1;
    }
    return 0;
};

let manaCostCompare = function (a, b) {
    let cmcA = 0;
    let cmcB = 0;
    let cmcCompute = function (manaSymbol) {
        // Put X spells at the end
        if (manaSymbol === "X") {
            return 100;
        }
        // Generic mana amount
        let intValue = parseInt(manaSymbol);
        if (!isNaN(intValue)) {
            return intValue;
        }
        // Colored mana
        return 1;
    };
    for (let manaSymbol of a) {
        cmcA += cmcCompute(manaSymbol);
    }
    for (let manaSymbol of b) {
        cmcB += cmcCompute(manaSymbol);
    }
    if (cmcA < cmcB) {
        return -1;
    }
    if (cmcB < cmcA) {
        return 1;
    }
    return 0;
};

let nameCompare = function (a, b) {
    if (a < b) {
        return -1;
    }
    if (b < a) {
        return 1;
    }
    return 0;
};

rivets.formatters.drawStatsSort = function(decklist) {
    if (decklist.length === 0) {
        return decklist;
    }
    if (sortMethod == "draw") {
        return decklist;
    } else if (sortMethod == "emerald") {
        return decklist.sort(
                function (a, b) {
                    // Sort by cardtype first
                    return cardtypeCompare(a.card_type, b.card_type)
                        // Then sort by mana cost
                        || manaCostCompare(a.cost, b.cost)
                        // Then sort by name
                        || nameCompare(a.card, b.card);
                });
    }
};

rivets.formatters.drawStatsMergeDuplicates = function(decklist) {
    let mergedDecklist = new Map();
    decklist.forEach((card) => {
        if (mergedDecklist.get(card.card)) {
            mergedDecklist.get(card.card).count_in_deck += card.count_in_deck;
        }
        else {
            mergedDecklist.set(card.card, card);
        }
    });
    return Array.from(mergedDecklist.values());
};

rivets.formatters.decklistSort = function(decklist) {
    if (decklist.length === 0) {
        return decklist;
    }
    if (sortMethod == "draw") {
        return decklist;
    } else if (sortMethod == "emerald") {
        return decklist.sort(
            function (a, b) {
                // Sort by cardtype first
                return cardtypeCompare(a.card_type, b.card_type)
                        // Then sort by mana cost
                        || manaCostCompare(a.cost, b.cost)
                        // Then sort by name
                        || nameCompare(a.pretty_name, b.pretty_name);
        });
    }
};

rivets.formatters.decklistMergeDuplicates = function(decklist) {
    let mergedDecklist = new Map();
    decklist.forEach((card) => {
        if (mergedDecklist.get(card.pretty_name)) {
            mergedDecklist.get(card.pretty_name).count_in_deck += card.count_in_deck;
        }
        else {
            mergedDecklist.set(card.pretty_name, card);
        }
    });
    return Array.from(mergedDecklist.values());
};

rivets.binders.showmessage = function(el, value) {
  if (value && remote.getGlobal('messagesAcknowledged').includes(value)) {
    el.style.display = "none"
  } else {
    el.style.display = "block"
  }
}

rivets.binders.showvault = function(el, value) {
  if (value > appData.minVaultProgress && appData.showVaultProgress) {
    el.style.display = "block"
  } else {
    el.style.display = "none";
  }
}

rivets.binders.wholemana = function(el, value) {
  if (value.length == 1) el.style.display = "inline-block"
  else el.style.display = "none"
}

rivets.binders.splitmana = function(el, value) {
  if (value.length > 1) el.style.display = "inline-block"
  else el.style.display = "none"
}

rivets.binders.mana = function(el, value) {
    mi_class = "mi-" + value.toLowerCase()
    el.classList.remove("mi-w")
    el.classList.remove("mi-b")
    el.classList.remove("mi-g")
    el.classList.remove("mi-u")
    el.classList.remove("mi-r")
    el.classList.remove("mi-1")
    el.classList.remove("mi-2")
    el.classList.remove("mi-3")
    el.classList.remove("mi-4")
    el.classList.remove("mi-5")
    el.classList.remove("mi-6")
    el.classList.remove("mi-7")
    el.classList.remove("mi-8")
    el.classList.remove("mi-9")
    el.classList.remove("mi-10")
    el.classList.remove("mi-x")
    el.classList.add(mi_class)
}

rivets.binders.splitmanafill = function(el, value) {
    if (!value.length > 1) return
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
    value = value.slice(1, -1)
    value = value.split("/")
    for (let idx in value) {
      let splitColor = value[idx]
      let newI = document.createElement("i")
      newI.classList.add("mi")
      newI.classList.add(`mi-${splitColor.toLowerCase()}`)
      el.appendChild(newI)
    }
}

rivets.binders.card_color = function(el, value) {
  el.classList.remove("card-b")
  el.classList.remove("card-g")
  el.classList.remove("card-r")
  el.classList.remove("card-u")
  el.classList.remove("card-w")

  el.classList.remove("card-c")  // colorless
  el.classList.remove("card-m")  // multicolor, not mountain
  let atLeastOneColor = false;

  if (value.length > 1) {
    // card-m sets the fade color
    el.classList.add("card-m")
  }

  if (value.length > 2) {
    // card-m-back sets the background image to generic 3-color background
    el.classList.add("card-m-back")
  } else {

      if (value.includes("Black")) {
        el.classList.add("card-b")
        atLeastOneColor = true
      }
      if (value.includes("White")) {
        el.classList.add("card-w")
        atLeastOneColor = true
      }
      if (value.includes("Blue")) {
        el.classList.add("card-u")
        atLeastOneColor = true
      }
       if (value.includes("Green")) {
        el.classList.add("card-g")
        atLeastOneColor = true
      }
       if (value.includes("Red")) {
        el.classList.add("card-r")
        atLeastOneColor = true
      }
      if (value.includes("Colorless") || !atLeastOneColor) {
        el.classList.add("card-c")
      }
  }
}

rivets.formatters.as_seconds = function(value) {
    return value / 100;
}

rivets.formatters.more_than_one = function(value) {
    return value > 1;
}

rivets.bind(document.getElementById('container'), appData)

var hideBackButton = function(hidden) {
  if(hidden) {
    $(".hide-on-rollup").addClass("rollup-modifier");
  } else {
    $(".hide-on-rollup").removeClass("rollup-modifier");
  }
}
function hideCallback(hidden) {
  console.log("hidden callback called")
  hideBackButton(hidden)
  resizeWindow()
}

document.getElementById("floating-eye").addEventListener("click", function() {
  hideModeManager.toggleHidden()
  ipcRenderer.send('hideRequest')
})

ws.addEventListener('open', () => {
    ws.send('hello!');
    console.log("sent hello")
});

function resizeWindow() {
    let total = 0;
    $.each($(".card"), function(i, c) {
        total += c.offsetHeight;
    })

    container = document.getElementById("container")

    let totalHeight = 10;

    $("#tracker-header").children().each(function(c, e) {
        if(e.style.display != "none" && !e.classList.contains("no-height-contribution"))
            totalHeight += $(e).outerHeight(true);
    });
    $("#tracker-body").children().each(function(c, e) {
        if(e.style.display != "none" && !e.classList.contains("no-height-contribution"))
            totalHeight += $(e).outerHeight(true);
    });
    bounds = browserWindow.getBounds()
    container.style.height = "" + parseInt(totalHeight) + "px"
    if (zoom > 0.85) {
      // TODO: resize with math that is less "throwing shit at the wall"
      // tbh this is stupid but it works for now
      // (and is probably better than setting max width and height and hoping transparent window works)
      let heightPower = 5;
      if (remote.getGlobal("useFlat")) {
        heightPower = 3;
      }
      totalHeight += parseInt(100 * (zoom ** heightPower))
      bounds.width = parseInt(354 * (zoom ** 2))
      if (0.85 < zoom && zoom < 0.95) {
        // dirty, dirty hack, but 0.9 is broken so.
        bounds.width += 30;
      }
    } else {
      bounds.width = parseInt(354 * zoom);
    }
    bounds.height = Math.min(parseInt(totalHeight), calcMainMaxHeight());
    if (!(debug || useFrame)) {
        browserWindow.setBounds(bounds)
    }
}

function populateDeck(elem) {
    deckID = elem.getAttribute('data-deckid');
    deck = getDeckById(deckID);
    if (deck != null){
      appData.selected_list = deck.cards;
        appData.selected_list_name = deck.pool_name;
        appData.list_selected = true;
        appData.no_list_selected = false;
    }

    appData.activeDeck = deckID;
    if (appData.winLossObj[appData.activeDeck] === undefined) {
      appData.winLossObj[appData.activeDeck] = {win: 0, loss: 0, name: deck.pool_name}
    }
    appData.deckWinCounter = appData.winLossObj[appData.activeDeck].win;
    appData.deckLossCounter = appData.winLossObj[appData.activeDeck].loss;

    resizeWindow()
}

function exitDraft() {
    appData.game_in_progress = false;
    appData.show_available_decklists = true;
    appData.showDraftStats = false;
    resizeWindow()
}

function unpopulateDecklist() {
    appData.list_selected = false;
    appData.no_list_selected = true;
    appData.activeDeck = 'total';
    appData.deckWinCounter = 0;
    appData.deckLossCounter = 0;

    appData.game_in_progress = false;
    appData.show_available_decklists = true;
    appData.showDraftStats = false;

    resizeWindow()
}

let getTrackerToken = () => {
  return new Promise((resolve, reject) => {
    let tokenOK = true;
    if (token) {
      if (jwt.decode(token).exp < Date.now() / 1000) tokenOK = false
    } else {
      tokenOK = false;
    }
    if (tokenOK) {
      console.log("old token was fine")
      resolve({token: token})
    } else {
      keytar.getPassword("mtgatracker", "tracker-id").then(trackerID => {
        console.log("sending token request...")
        request.post({
            url: `${API_URL}/public-api/tracker-token`,
            json: true,
            body: {trackerID: trackerID},
            headers: {'User-Agent': 'MTGATracker-App'}
        }, (err, res, data) => {
          if (err || res.statusCode != 200) {
            errors.push({on: "get_token", error: err || res})
            reject({attempt: attempt, errors: errors})
          } else {
            token = data.token;
            resolve({token: data.token})
          }
        })
      })
    }
  })
}

function passThrough(endpoint, passData, playerKey, errors) {
  if (!errors) {
    errors = []
  }
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      getTrackerToken().then(tokenObj => {
        let {token} = tokenObj;
        passData.hero = playerKey;
        if (!remote.getGlobal("incognito")) {  // we're only allowed to use passThrough data if not incognito
          setTimeout(() => {
            console.log(`posting ${endpoint} request...`)
            request.post({
              url: `${API_URL}/${endpoint}`,
              json: true,
              body: passData,
              headers: {'User-Agent': 'MTGATracker-App', token: token}
            }, (err, res, data) => {
              console.log(`finished posting ${endpoint} request...`)
              if (err || res.statusCode != 200) {
                errors.push({on: `post_${endpoint}`, error: err || res})
                reject({errors: errors})
              } else {
                console.log(`${endpoint} uploaded! huzzah!`)
                resolve({
                  success: true
                })
              }
            })
          }, 100 * uploadDelay)
        }
      })
    }, 3000)  // wait a second to let the game result be saved before trying to modify it's rank
  })
}

function cleanError(error, depth, maxDepth) {
  if (depth === undefined) depth = 0;
  if (maxDepth === undefined) maxDepth = 3;
  if (depth >= maxDepth) return;
  if (error && typeof error === 'object') {
    for (let key in error) {
      if (key == "token") {
        delete error[key]
      } else {
        cleanError(error[key], depth+1, maxDepth)
      }
    }
  }
}

function cleanErrors(errors) {
  errors.forEach(error => cleanError(error, 0))
}

function getDeckById(deckID){
  var deck;
  $.each(appData.player_decks, (i, v) => {
      if (v.deck_id == deckID) {
         deck = v;
         return false;
      }
  })
  return deck;
}

function uploadGame(attempt, gameData, errors) {
  if (!errors) {
    errors = []
  }
  if (attempt == 0) { // only set local winloss counters on first upload attempt
    const victory = gameData.players[0].name === gameData.winner;
    if (victory) {
      appData.winLossObj.total.win++
    } else {
      appData.winLossObj.total.loss++
    }
    ipcRenderer.send('updateWinLossCounter', {
      key: "total",
      value: {win: appData.winLossObj.total.win, loss: appData.winLossObj.total.loss}
    })
    //only update per-deck win/loss for decks we know about
    const deckID = gameData.players[0].deck.deckID;
    if (appData.player_decks.map(deck=>deck.deck_id).includes(deckID)) {
      if(appData.winLossObj[deckID]) {
        if (victory) {
          appData.winLossObj[deckID].win++
        } else {
          appData.winLossObj[deckID].loss++
        }
      } else {
        if (victory) {
          appData.winLossObj[deckID] = {win: 1, loss: 0, name: gameData.players[0].deck.pool_name}
        } else {
          appData.winLossObj[deckID] = {win: 0, loss: 1, name: gameData.players[0].deck.pool_name}
        }
      }
      ipcRenderer.send('updateWinLossCounter', {
        key: deckID,
        value: appData.winLossObj[deckID]
      })
    }
  }

  return new Promise((resolve, reject) => {
    if (attempt > 5) {
      if (!remote.getGlobal("incognito")) {
        addMessage("WARNING! Could not upload game result to inspector! Error log generated @ uploadfailure.log ... please send this log to our discord #bug_reports channel!")
        resizeWindow()
      }
      let filePath = runFromSource ? "uploadfailure.log" : "../uploadfailure.log";
      cleanErrors(errors)
      fs.writeFile(filePath, JSON.stringify({fatal: "too_many_attempts", errors: errors}))
      reject({fatal: "too_many_attempts", errors: errors})
    } else {
      let delay = 1000 * attempt;
      setTimeout(() => {
        getTrackerToken().then(tokenObj => {
          let {token} = tokenObj;
          if (token.errors) {
            errors.push({on: "get_token", error: err || res})
            resolve({attempt: attempt, errors: errors})
          } else {
            gameData.client_version = appData.version
            if (remote.getGlobal("incognito")) {  // we're not allowed to use this game data :(
              gameData = {anonymousUserID: crypto.createHash('md5').update(gameData.players[0].name).digest("hex")}
            }
            console.log("posting game request...")
            let postGameUrl = `${API_URL}/tracker-api/game`
            if (remote.getGlobal("incognito")) {
              postGameUrl = `${API_URL}/anon-api/game`
            }
            setTimeout(() => {
              request.post({
                url: postGameUrl,
                json: true,
                body: gameData,
                headers: {'User-Agent': 'MTGATracker-App', token: token}
              }, (err, res, data) => {
                console.log("finished posting game request...")
                console.log(res)
                console.log(err)
                if (err || res.statusCode != 201) {
                  errors.push({on: "post_game", error: err || res})
                  resolve({attempt: attempt, errors: errors})
                } else {
                  resolve({
                    success: true
                  })
                }
              })
            }, 100 * uploadDelay)
          }
        })
      }, delay)
    }
  }).then(result => {
    if (!result || !result.success) {
      return uploadGame(++attempt, gameData, result.errors)
    } else {
      return result
    }
  })
}

let gameAlreadyUploaded = (gameID) => {
  return Object.keys(gameLookup).includes(gameID)
}

let onMessage = (data) => {
    data = JSON.parse(event.data)
    if (data.data_type == "game_state") {
        if (data.match_complete) {

            timerRunning = false;
            $("#opponent-timer").removeClass("active")
            $("#hero-timer").removeClass("active")
            overallTimer.pause()
            heroTimer.pause()
            opponentTimer.pause()

            console.log("match over")
            if (data.game && gameAlreadyUploaded(data.game.gameID)) {
              console.log(`Backend sent match_complete for ${data.game.gameID}, but already know that game`)
            } else if (data.game) {
              appData.game_complete = true;
              $(".cardsleft").addClass("gamecomplete")

              gameLookup[data.game.gameID] = {count: 0, uploaded: true}
              uploadGame(0, data.game)
                .then(() => {
                  if (!remote.getGlobal("incognito") && remote.getGlobal("showInspector")) {
                    addMessage("Game sent to Inspector!", "https://inspector.mtgatracker.com")
                  }
                })
            } else if (data.gameID) {
              console.log(`match_complete and gameID ${data.gameID} but no game data`)
              if (gameAlreadyUploaded(data.gameID)) {
                if (gameLookup[data.gameID].count++ > 5) {
                  if (!gameLookup[data.gameID].uploaded) {
                    gameLookup[data.gameID].uploaded = true
                    if (lastGameState) {
                      uploadGame(0, lastGameState)
                        .then(() => {
                          console.log("successfully uploaded game!")
                          if (!remote.getGlobal("incognito") && remote.getGlobal("showInspector")) {
                            addMessage("Game sent to Inspector!", "https://inspector.mtgatracker.com")
                          }
                        })
                    }
                  }
                }
              } else { // gameLookup doesn't know this game yet
                console.log(`haven't seen ${data.gameID} before, adding now'`)
                gameLookup[data.gameID] = {count: 0, uploaded: false}
              }
            }
        } else if (!gameAlreadyUploaded(data.game_id)) {
            lastGameState = data
            if (!timerRunning) {
              timerRunning = true;
              console.log("TIMER: resetcss")
              // this is transition into a game. reset all the timers
              overallTimer.reset()
              opponentTimer.reset()
              heroTimer.reset()
              overallTimer.start()
              // pause each player's timer. we'll unpause them soon, with a decisionPlayerChange event.
              opponentTimer.pause()
              heroTimer.pause()

              //set the stats to report for this deck, if known
              //otherwise, use total stats
              if (appData.player_decks.map(deck=>deck.deck_id).includes(data.deck_id)){
                let deck = getDeckById(data.deck_id);
                appData.activeDeck = data.deck_id
                if (!(data.deck_id in appData.winLossObj)){
                  appData.winLossObj[appData.activeDeck] = {win: 0, loss: 0, name: deck.pool_name};
                }
                appData.deckWinCounter = winLossCounterInitial[data.deck_id].win
                appData.deckLossCounter = winLossCounterInitial[data.deck_id].loss
              } else {
                appData.activeDeck = 'total'
                appData.deckWinCounter = 0
                appData.deckLossCounter = 0
              }
            }
            appData.game_in_progress = true;
            appData.show_available_decklists = false;
            appData.showDraftStats = false;
            appData.game_complete = false;
            $(".cardsleft").removeClass("gamecomplete")

            appData.deck_name = data.draw_odds.deck_name;
            appData.opponent_hand = data.opponent_hand;

            if (staticMode) {
              appData.draw_stats = data.draw_odds.original_deck_stats;
              appData.total_cards_in_deck = data.draw_odds.original_decklist_total;
            } else {
              appData.draw_stats = data.draw_odds.stats;
              appData.total_cards_in_deck = data.draw_odds.total_cards_in_deck;
            }
        }
    } else if (data.game_history_event) {
      ipcRenderer.send('gameHistoryEvent', data.game_history_event)
    } else if (data.data_type == "error") {
        if (data.count) {
            appData.error_count = data.count;
        }
        appData.last_error = data.msg;
    } else if (data.data_type == "message") {
        if (data.right_click) {
            hideModeManager.toggleHidden(!appData.invertHideMode)
            ipcRenderer.send('hideRequest', !appData.invertHideMode)
        } else if (data.left_click && remote.getGlobal("leftMouseEvents")) {
            hideModeManager.toggleHidden(appData.invertHideMode)
            ipcRenderer.send('hideRequest', appData.invertHideMode)
        } else if (data.draft_collection_count) {
          console.log("handle draft stuff")
          console.log(data.draft_collection_count)

          appData.game_in_progress = false;
          appData.show_available_decklists = false;
          appData.showDraftStats = true;

          appData.draftStats = data.draft_collection_count
        } else if (data.rank_change) {
          passThrough("tracker-api/rankChange", data.rank_change, data.player_key).catch(e => {
            console.log("error uploading rank data: ")
            console.log(e)
          })
        } else if (data.inventory_update) {
         // passThrough("tracker-api/inventory-update", data.inventory_update, data.player_key).catch(e => {
         // // TODO: check for wildcard redemptions? or should we do that in the API?
         //   console.log("error uploading inventory-update data: ")
         //   console.log(e)
         // })
        } else if (data.inventory) {
          if (data.inventory.vaultProgress) {
            appData.lastVaultProgress = data.inventory.vaultProgress;

            ipcRenderer.send('settingsChanged', {
              key: "lastVaultProgress",
              value: appData.lastVaultProgress
            })
          }
         // passThrough("tracker-api/inventory", data.inventory, data.player_key).catch(e => {
         //   console.log("error uploading inventory data: ")
         //   console.log(e)
         // })
        } else if (data.collection) {
          var cardQuantity;
          if (data.collection) {
            if(appData.lastCollection && (Object.keys(appData.lastCollection).length != 0)) {
              var objectToPush = {time:(new Date(Date.now())).toLocaleString(), cardsObtained:{}};
              for(var cardID in data.collection) {
                  if(data.collection.hasOwnProperty(cardID)) {
                      if(/^\d+$/.test(cardID)) {
                        cardQuantity = data.collection[cardID] - appData.lastCollection[cardID];
                        if(isNaN(cardQuantity)) {
                          cardQuantity = data.collection[cardID];
                        }
                        if(cardQuantity > 0) {
                          objectToPush.cardsObtained[cardID] = cardQuantity;
                        }
                      }
                  }
              }

              if(Object.keys(objectToPush.cardsObtained).length > 0) {
                appData.recentCards.unshift(objectToPush);
                console.log(appData.recentCards);
                ipcRenderer.send('settingsChanged', {
                  key: "recentCards",
                  value: appData.recentCards
                })
              }
            }

            appData.lastCollection = data.collection
            ipcRenderer.send('settingsChanged', {
              key: "lastCollection",
              value: appData.lastCollection
            })

           // passThrough("tracker-api/collection", data.collection, data.player_key).catch(e => {
           //   console.log("error uploading collections data: ")
           //   console.log(e)
           // })
          }
        } else if (data.draftPick) {
          passThrough("tracker-api/draft-pick", data.draftPick, data.player_key).catch(e => {
            console.log("error uploading draftPick data: ")
            console.log(e)
          })
        } else if (data.decisionPlayerChange) {
            if (data.heroIsDeciding) {
                opponentTimer.start()
                heroTimer.pause()
                $("#opponent-timer").removeClass("active")
                $("#hero-timer").addClass("active")
            } else {
                opponentTimer.pause()
                heroTimer.start()
                $("#opponent-timer").addClass("active")
                $("#hero-timer").removeClass("active")
            }
        } else if (data.authenticateResponse) {
          console.log("handle authenticateResponse")
          // TODO save user?
        }
    } else if (data.data_type=="decklist_change") {
        if (data.decks.no_decks_defined) {
            appData.no_decks = true;
        } else {
            new_decks = []
            $.each(data.decks, (key, value) => {
                new_decks.push(value)
            })
            appData.player_decks = new_decks;
            appData.no_decks = false;
        }
    }
    resizeWindow()
}

document.addEventListener("DOMContentLoaded", function(event) {

    hideModeManager = hideWindowManager({
      useRollupMode: function() {return remote.getGlobal('rollupMode')},
      getHideDelay: function() {return remote.getGlobal('hideDelay')},
      getInverted: function() {return remote.getGlobal('invertHideMode')},
      windowName: "mainRenderer",
      bodyID: "#tracker-body",
      headerID: "#tracker-header",
      containerID: "#container",
      hideCallback: hideCallback,
    })

    setInterval(() => {
        $('#overall-timer').html(overallTimer.getTimeValues().toString());
        $('#hero-timer').html(opponentTimer.getTimeValues().toString());
        $('#opponent-timer').html(heroTimer.getTimeValues().toString());
    }, 1000)

    if (debug || useFrame) {
        $("#container").addClass("container-framed")
        $("body").css("background-color", "green")
    } else {
        $("#container").addClass("container-normal")
    }
    $("#floating-settings").click(() => {
      ipcRenderer.send('openSettings', null)
    })
    $("#floating-history").click(() => {
      ipcRenderer.send('openHistory', null)
    })
    $(".zoom-out").click(() => {
        zoom -= 0.1
        zoom = Math.max(zoom, 0.2)
        browserWindow.webContents.setZoomFactor(zoom)
        ipcRenderer.send('settingsChanged', {key: "zoom", value: zoom})
    })
    $(".zoom-in").click(() => {
        zoom += 0.1
        browserWindow.webContents.setZoomFactor(zoom)
        ipcRenderer.send('settingsChanged', {key: "zoom", value: zoom})
    })
    //open links externally by default
    $(document).on('click', 'a[href^="http"]', function(event) {
        event.preventDefault();
        shell.openExternal(this.href);
    });
    // load theme on first launch without settings change
    if (lastThemeFile && lastUseTheme) {
    let currentThemeLink = $("#theme")
    if (currentThemeLink) {
      currentThemeLink.remove()
    }
    if (lastUseTheme) {
      let head  = document.getElementsByTagName('head')[0];
      let link  = document.createElement('link');
      link.id   = 'theme';
      link.rel  = 'stylesheet';
      link.type = 'text/css';
      let themePath = runFromSource ? "themes/" : "../../../themes/";
      link.href = themePath + lastThemeFile;
      head.appendChild(link)
    }
  }
  ws.onmessage = onMessage
});

ipcRenderer.on('stdout', (event, data) => {
  console.log(data.text)
})

ipcRenderer.on('updateReadyToInstall', (messageInfo) => {
  addMessage("A new tracker update will be applied on next launch!", "https://github.com/shawkinsl/mtga-tracker/releases/latest")
})

ipcRenderer.on('settingsChanged', () => {
  debug = remote.getGlobal('debug');
  appData.debug = debug

  mtgaOverlayOnly = remote.getGlobal('mtgaOverlayOnly');
  appData.mtgaOverlayOnly = mtgaOverlayOnly

  sortMethod = remote.getGlobal('sortMethod');

  useFrame = remote.getGlobal('useFrame');
  appData.useFrame = useFrame

  staticMode = remote.getGlobal('staticMode');
  appData.staticMode = staticMode

  showIIDs = remote.getGlobal('showIIDs');
  appData.showIIDs = showIIDs

  showErrors = remote.getGlobal('showErrors');
  appData.showErrors = showErrors

  appVersionStr = remote.getGlobal('version');
  appData.appVersionStr = appVersionStr

  showTotalWinLossCounter = remote.getGlobal('showTotalWinLossCounter');
  appData.showTotalWinLossCounter = showTotalWinLossCounter

  showDeckWinLossCounter = remote.getGlobal('showDeckWinLossCounter');
  appData.showDeckWinLossCounter = showDeckWinLossCounter

  showVaultProgress = remote.getGlobal('showVaultProgress');
  appData.showVaultProgress = showVaultProgress

  showGameTimer = remote.getGlobal('showGameTimer');
  appData.showGameTimer = showGameTimer

  showChessTimers = remote.getGlobal('showChessTimers');
  appData.showChessTimers = showChessTimers

  hideDelay = remote.getGlobal('hideDelay');
  appData.hideDelay = hideDelay

  invertHideMode = remote.getGlobal('invertHideMode');
  appData.invertHideMode = invertHideMode

  rollupMode = remote.getGlobal('rollupMode');
  appData.rollupMode = rollupMode

  recentCards = remote.getGlobal('recentCards');
  appData.recentCards = recentCards

  winLossCounter = remote.getGlobal('winLossCounter');
  appData.totalWinCounter = winLossCounter['total'].win;
  appData.totalLossCounter = winLossCounter['total'].loss;
  if (appData.activeDeck == 'total'){
    appData.deckWinCounter = 0
    appData.deckLossCounter = 0
  } else {
    appData.deckWinCounter = winLossCounter[appData.activeDeck].win;
    appData.deckLossCounter = winLossCounter[appData.activeDeck].loss;
  }

  appData.winLossObj = winLossCounter

  let useTheme = remote.getGlobal("useTheme")
  let themeFile = remote.getGlobal("themeFile")
  let useFlat = remote.getGlobal("useFlat")

  let currentFlatLink = $("#flat")
  if (useFlat) {
    if(!currentFlatLink.length) {
      let head  = document.getElementsByTagName('head')[0];
      let link  = document.createElement('link');
      link.id   = 'flat';
      link.rel  = 'stylesheet';
      link.type = 'text/css';
      link.href = 'flat.css';
      head.appendChild(link)
    } else {
      console.log(currentFlatLink)
    }
  } else if (currentFlatLink) {
    currentFlatLink.remove()
  }

  let useMinimal = remote.getGlobal("useMinimal")

  let currentMinimalLink = $("#minimal")
  if (useMinimal) {
    if (!currentMinimalLink.length) {
      let head  = document.getElementsByTagName('head')[0];
      let link  = document.createElement('link');
      link.id   = 'minimal';
      link.rel  = 'stylesheet';
      link.type = 'text/css';
      link.href = 'minimal.css';
      head.appendChild(link)
    }
  } else if (currentMinimalLink) {
    currentMinimalLink.remove()
  }

  if ((themeFile && (themeFile != lastThemeFile)) || useTheme != lastUseTheme) {
    lastThemeFile = themeFile
    lastUseTheme = useTheme
    let currentThemeLink = $("#theme")
    if (currentThemeLink) {
      currentThemeLink.remove()
    }
    if (useTheme) {
      let head  = document.getElementsByTagName('head')[0];
      let link  = document.createElement('link');
      link.id   = 'theme';
      link.rel  = 'stylesheet';
      link.type = 'text/css';
      let themePath = runFromSource ? "themes/" : "../../../themes/";
      link.href = themePath + lastThemeFile;
      head.appendChild(link)
    }
  }
  resizeWindow()
})

console.timeEnd('init')
