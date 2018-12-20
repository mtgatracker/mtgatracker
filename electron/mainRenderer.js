console.time('init')

const request = require("request")
const crypto = require("crypto")
const ReconnectingWebSocket = require('./vendor/rws.js')
const fs = require('fs')
const jwt = require('jsonwebtoken')
const Timer = require('easytimer.js');
const keytar = require('keytar')
const hideWindowManager = require("./hide-manager")

const { remote, ipcRenderer, shell, clipboard } = require('electron')
const { Menu, MenuItem } = remote
let browserWindow = remote.getCurrentWindow()
const activeWin = require("active-win")
const mousetrap = require('mousetrap')

function contextData(data) {
  // find out what context we are in.
  // return data for that context as a single string value.
  if (data.showDraftStats) {
    return appData.draftStats.map(card=>card.pretty_name).join('\n')
  } else if (data.list_selected) {
    return data.selected_list.map(
      c=>(c.count_in_deck + ' ' + c.pretty_name + ' (' + c.set + ') ' + c.set_number)
    ).join('\n')
  } else if (data.show_available_decklists) {
    return data.player_decks.map( d=>d.pool_name ).join('\n')
  } else if (data.draw_stats.length) {
    // FIXME: Figure out where the set and card numbers are stored.
    return data.draw_stats.map(
      c=>(c.count_in_deck + ' ' + c.card)
    ).join('\n')
  } else {
    console.log('Contextual copy found no data.')
  }
}

function copyData() {
  // This should copy the data on the current screen onto the clipboard.
  // The format should be context specific, comma or tab delimited seems
  // like the best choice for most stuff.
  // TODO: deck lists.

  console.log('Copying relevant data to clipboard, if any.')
  let dataString = contextData(appData)

  if (dataString) {
    clipboard.writeText(dataString)
  }
}

function copyEventHandler(e) {
  copyData()
}

var { rendererPreload } = require('electron-routes');
rendererPreload();

let addClickHandler = (selector,handler) => {
  let new_handler = (e) => {
    if (!$.contains($('.menu-div').get(0),event.target) && !$('#main-menu').hasClass('hide-me')){
      e.preventDefault()
      e.stopPropagation()
      toggleMenu()
    } else {
      if ( handler != null){
        handler(e)
      }
    }
  }
  $(selector).each( (i,elem) => {
    $(elem).off().on('click',new_handler)
  })
}

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

const contextMenu = new Menu()
const contextMenuItem = new MenuItem({
  label: 'Inspect Element',
  click: () => {
    remote.getCurrentWindow().inspectElement(rightClickPosition.x, rightClickPosition.y)
  }
})
contextMenu.append(contextMenuItem)

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
var showDailyTotalWinLossCounter = remote.getGlobal('showDailyTotalWinLossCounter');
var showDailyDeckWinLossCounter = remote.getGlobal('showDailyDeckWinLossCounter');
var showVaultProgress = remote.getGlobal('showVaultProgress');
var lastCollection = remote.getGlobal('lastCollection');
var lastVaultProgress = remote.getGlobal('lastVaultProgress');
var minVaultProgress = remote.getGlobal('minVaultProgress');
var sortMethod = remote.getGlobal('sortMethod');
var showChessTimers = remote.getGlobal('showChessTimers');
var hideDelay = remote.getGlobal('hideDelay');
var invertHideMode = remote.getGlobal('invertHideMode');
var rollupMode = remote.getGlobal('rollupMode');
var minToTray = remote.getGlobal('minToTray');
var recentCardsQuantityToShow = remote.getGlobal('recentCardsQuantityToShow');
var showGameTimer = remote.getGlobal('showGameTimer');
var zoom = remote.getGlobal('zoom');
var recentCards = remote.getGlobal('recentCards');
var port = remote.getGlobal('port');
var timerRunning = false;
var uploadDelay = 0;
var hideModeManager;
var showUIButtons = remote.getGlobal('showUIButtons')
var showHideButton = remote.getGlobal('showHideButton')
var showMenu = remote.getGlobal('showMenu')
var useMinimal = remote.getGlobal('useMinimal')

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
    contextMenu.popup(remote.getCurrentWindow())
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
    showDailyTotalWinLossCounter: showDailyTotalWinLossCounter,
    showDailyDeckWinLossCounter: showDailyDeckWinLossCounter,
    showDeckCounters: false,
    winLossObj: winLossCounterInitial,
    activeDeck: 'total',
    totalWinCounter: winLossCounterInitial.alltime.total.win,
    totalLossCounter: winLossCounterInitial.alltime.total.loss,
    deckWinCounter: 0,
    deckLossCounter: 0,
    dailyTotalWinCounter: winLossCounterInitial.daily.total.win,
    dailyTotalLossCounter: winLossCounterInitial.daily.total.win,
    dailyDeckWinCounter: 0,
    dailyDeckLossCounter: 0,
    showVaultProgress: showVaultProgress,
    showGameTimer: showGameTimer,
    showChessTimers: showChessTimers,
    hideDelay: hideDelay,
    invertHideMode: invertHideMode,
    rollupMode: rollupMode,
    recentCardsQuantityToShow: recentCardsQuantityToShow,
    recentCards: recentCards,
    minToTray: minToTray,
    showUIButtons: showUIButtons,
    showHideButton: showHideButton,
    showMenu: showMenu
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
  let $element = $(element)
  if ($element.hasClass('no-dismiss')){
    return
  }
  if (!$element.hasClass('message-container')){
    element = $(element).parents('.message-container').get(0)
  }

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

let deckFrequencySubLists = function (decklist) {
  let card_count = -1;
  let sublists = [];
  let current_sublist = null;
  let reverse_sort = function(a, b){return b.count_in_deck - a.count_in_deck}
  // Don't mutate input list
  sorted_deck = [...decklist].sort(reverse_sort)
  for ( card of sorted_deck ) {
    if (card.count_in_deck != card_count){
      if ( current_sublist != null ){
        sublists.push(current_sublist);
      }
      current_sublist = [];
      card_count = card.count_in_deck;
    }
    current_sublist.push(card);
  }
  sublists.push(current_sublist);
  return sublists;
};

let emeraldSort = function (decklist) {
   return decklist.sort(
            function (a, b) {
                // Sort by cardtype first
                return cardtypeCompare(a.card_type, b.card_type)
                        // Then sort by mana cost
                        || manaCostCompare(a, b)
                        // Then sort by name
                        || nameCompare(a, b);
            }
    );
};

let drawSort = function (decklist,subsort) {
  let sublists = deckFrequencySubLists(decklist);
  let sorted = [];
  for (sublist of sublists){
    if (subsort === 'name') {
      sorted.push(sublist.sort( (a,b) => { return nameCompare(a,b); } ));
    } else if ( subsort === 'emerald' ) {
      sorted.push(emeraldSort(sublist));
    } else if ( subsort === 'color' ) {
      sorted.push(colorSort(sublist));
    }
  }
  //flatten
  return [].concat.apply([], sorted);
}

let colorSort = function (decklist) {
    return decklist.sort(
            function (a, b) {
                // Sort by cmc first
                return manaCostCompare(a, b)
                        // then sort by color
                        || colorCompare(a,b)
                        // Then sort by name
                        || nameCompare(a, b);
            }
    );
}

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

let cmcCompute = function (card) {
  //put lands at bottom
  if ( card.card_type === 'Land'){
    return 1000;
  }

  let total = 0;
  for (let manaSymbol of card.cost) {
    // Put X spells at the end
    if (manaSymbol === "X") {
        total += 100;
    } else {
      // Generic mana amount
      let intValue = parseInt(manaSymbol);
      if (!isNaN(intValue)) {
        total += intValue;

      } else {
        // Colored mana
        total += 1;
      }
    }
  }

  return total;
};

let manaCostCompare = function (a, b) {
    let cmcA = cmcCompute(a);
    let cmcB = cmcCompute(b);

    if (cmcA < cmcB) {
        return -1;
    }
    if (cmcB < cmcA) {
        return 1;
    }
    return 0;
};

let nameCompare = function (a, b) {
    let field = null
    if (a.pretty_name != undefined){
      field = 'pretty_name'
    } else if (a.card != undefined){
      field = 'card'
    }
    if (a[field] < b[field]) {
        return -1;
    }
    if (b[field] < a[field]) {
        return 1;
    }
    return 0;
};

/**
 * Rank color combos.
 *
 * Each color is assigned value
 * W=1 U=2 B=4 R=8 G=16 C=32 L=+32
 *
 * Array holds total color values in sorted order.
 * To find sort position of particular card,
 * get index of color combo value
 */

let color_ranks = [
  1,2,4,8,16,     // W U B G R
  3,5,9,17,       // WU WB WR WG
  6,10,18,        // UB UR UG
  12,20,          // BR BG
  24,             // RG
  7,11,19,        // WUB WUR WUG
  13,21,          // WBR WBG
  25,             // WRG
  14,22,26,       // UBR UBG URG
  28,             // BRG
  15,23,27,29,30, // WUBR WUBG WURG WBRG UBRG
  31,             // WUBRG
  32,             // C
  33,34,36,40,48, // L W U B G R
  35,37,41,49,    // L WU WB WR WG
  38,42,50,       // L UB UR UG
  44,52,          // L BR BG
  56,             // L RG
  39,43,51,       // L WUB WUR WUG
  45,53,          // L WBR WBG
  57,             // L WRG
  46,54,58,       // L UBR UBG URG
  60,             // L BRG
  47,55,59,61,62, // L WUBR WUBG WURG WBRG UBRG
  63,             // L WUBRG
  64              // L C
]

let colorCompare = function (a,b) {
  let a_index = color_ranks.indexOf(getColorValue(a));
  let b_index = color_ranks.indexOf(getColorValue(b));
  if ( a_index < b_index ) {
    return -1;
  } else if ( a_index === b_index ) {
    return 0;
  } else {
    return 1;
  }
}

let getColorValue = function(card) {
  let value = card.cardtype === 'Land' ? 32 : 0
  for ( color of card.colors) {
    if ( color === 'White' ){
      value += 1
    } else if ( color === 'Blue' ) {
      value += 2
    } else if ( color === 'Black' ) {
      value += 4
    } else if ( color === 'Red') {
      value += 8
    } else if ( color === 'Green' ){
      value += 16
    } else if ( color === 'Colorless' ){
      value += 32
    }
  }
  return value;
}

let mergeDuplicates = function(decklist) {
    let field = 'pretty_name'
    if (decklist[0].card != undefined){ field = 'card'}
    let mergedDecklist = new Map();
    decklist.forEach((card) => {
        if (mergedDecklist.get(card[field])) {
            mergedDecklist.get(card[field]).count_in_deck += card.count_in_deck;
        }
        else {
            mergedDecklist.set(card[field], Object.assign({}, card));
        }
    });
    return Array.from(mergedDecklist.values());
};

rivets.formatters.decklistSort = function(decklist) {
    if (decklist.length === 0) {
        return decklist;
    }

    let sorted_decklist = mergeDuplicates(decklist)
    if (sortMethod.startsWith("draw")) {
        let subsort = sortMethod.split('-')[1];
        if ( subsort === undefined ){
          subsort = 'name';
        }
        return drawSort(sorted_decklist,subsort);
    } else if (sortMethod == "emerald") {
        return emeraldSort(sorted_decklist);
    } else if (sortMethod == "color") {
        return colorSort(sorted_decklist);
    }
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

rivets.binders.manasymbols = (el,cost) => {
  let $el = $(el);
  $el.children().remove()

  for (let symbol of cost){
    let $span = $('<span class="mana-symbol"></span>')
    let colors = []

    if (symbol.indexOf('/') == -1) {
      colors.push(symbol.toLowerCase())
    } else {
      colors = symbol.split('/').map(x => x.replace('(','').replace(')','').toLowerCase())
      $span.addClass('mi-split').addClass('mi-split-color')
    }
    for (let color of colors) {
      let $i = ($('<i class="mi mi-shadow mi-' + color + '"></i>'))
      if (colors.length == 1){
        $i.addClass('mi-mana')
      }
      $span.append($i)
    }

    $(el).append($span)
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

    let totalHeight = 0;
    totalHeight += $('#tracker-header').outerHeight(true);
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

    let menuHeight = 0
    let selectors = ['#tracker-header h1', '#main-menu ul', '#main-menu ul li ul']
    for (selector of selectors) {
      menuHeight += $(selector).outerHeight(true)
    }

    if (menuHeight > totalHeight) {
      totalHeight = menuHeight
    }

    bounds.height = Math.min(parseInt(totalHeight), calcMainMaxHeight());
    if (!(debug || useFrame)) {
        browserWindow.setBounds(bounds)
    }
    setClickHandlers();
}

function populateDeck(elem) {
    deckID = elem.getAttribute('data-deckid');
    appData.activeDeck = deckID;
    deck = getDeckById(deckID);

    const types = ['daily','alltime'];
    $.each(types, (i, type) => {
      if (appData.winLossObj[type][deckID] === undefined) {
        appData.winLossObj[type][deckID] = {win: 0, loss: 0, name: deck.pool_name}
      }
      const counter_prefix = type === 'daily' ? 'dailyDeck' : 'deck';
      appData[counter_prefix + 'WinCounter'] = appData.winLossObj[type][deckID].win;
      appData[counter_prefix + 'LossCounter'] = appData.winLossObj[type][deckID].loss;
    });

    if (deck != null){
      appData.selected_list = deck.cards;
      appData.selected_list_name = deck.pool_name;
      appData.list_selected = true;
      appData.no_list_selected = false;
      appData.showDeckCounters = true;
    }

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
    appData.dailyDeckWinCounter = 0;
    appData.dailyDeckLossCounter = 0;
    appData.showDeckCounters = false;

    appData.game_in_progress = false;
    appData.show_available_decklists = true;
    appData.showDraftStats = false;

    resizeWindow()
}

function passThrough(endpoint, passData, playerID) {
  passData.playerId = playerID;
  return new Promise((resolve, reject) => {
    console.log(`posting ${endpoint} request...`)
    let fetchURL = `insp://${endpoint}`
    fetch(fetchURL, {method: "POST", body: JSON.stringify(passData)})
    .then(resp => resp.json())
    .then(data => {
      if (data.error) throw new Error(data.error)
      console.log(`finished posting ${endpoint} request...`)
      resolve({success: true})
    }).catch(err => {
      addMessage(`WARNING! Could not record ${endpoint}! Please contact us in Discord for support! (${err})`)
      console.log(err)
      reject({on: `post_${endpoint}`, error: err || res})
    })
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
  return appData.player_decks.find(x => x.deck_id == deckID) || false
}

function uploadGame(gameData) {
    const victory = gameData.players[0].name === gameData.winner;

    //only update per-deck win/loss for decks we know about
    const deckID = gameData.players[0].deck.deckID;
    if (appData.player_decks.map(deck=>deck.deck_id).includes(deckID)) {
      const types = ['daily','alltime'];
      $.each(types, (i, type) => {
        if(appData.winLossObj[type][deckID]) {
          if (victory) {
            appData.winLossObj[type][deckID].win++;
          } else {
            appData.winLossObj[type][deckID].loss++;
          }
        } else {
          if (victory) {
            appData.winLossObj[type][deckID] = {win: 1, loss: 0, name: gameData.players[0].deck.poolName};
          } else {
            appData.winLossObj[type][deckID] = {win: 0, loss: 1, name: gameData.players[0].deck.poolName};
          }
        }
      });

      ipcRenderer.send('updateWinLossCounters', {
        key: deckID,
        value: {alltime: appData.winLossObj['alltime'][deckID],daily:appData.winLossObj['daily'][deckID]}
      })
    }
    if (victory) {
      appData.winLossObj.alltime.total.win++;
      appData.winLossObj.daily.total.win++;
    } else {
      appData.winLossObj.alltime.total.loss++;
      appData.winLossObj.daily.total.loss++;
    }
    ipcRenderer.send('updateWinLossCounters', {
      key: "total",
      value: {alltime:appData.winLossObj.alltime.total,daily:appData.winLossObj.daily.total}
    });

  let fetchURL = `insp://insert-game`
  fetch(fetchURL, {method: "POST", body: JSON.stringify(gameData)})
    .then(resp => resp.json())
    .then(data => {
      if (data.error) {
        throw new Error(data.error)
      }
      console.log(`got ${data} from insert-game`)
      console.log(data)

      if (remote.getGlobal("showInspector")) {
        // TODO: open inspector window instead of linking to https://inspector...
        addMessage("Game saved in Inspector!", "javascript:openInspector();")
      }
    })
    .catch(err => {
      console.log(err)
      addMessage(`WARNING! Could not save game result! Please contact us in Discord for support! (${err})`)
    })

  return new Promise((resolve, reject) => {
    let anonGameData = {
      anonymousUserID: crypto.createHash('md5').update(gameData.players[0].name).digest("hex"),
      gameID: crypto.createHash('md5').update(gameData.gameID).digest("hex"),
      client_version: appData.version,
    }
    console.log("posting game request...")
    console.log(anonGameData)
    postGameUrl = `${API_URL}/anon-api/game`
    request.post({
      url: postGameUrl,
      json: true,
      body: anonGameData,
      headers: {'User-Agent': 'MTGATracker-App', token: token}
    }, (err, res, data) => {
      console.log("finished posting game request...")
      console.log(res)
      console.log(err)
      if (err || res.statusCode != 201) {
        console.log({on: "post_game", error: err || res})
        resolve({attempt: attempt, errors: errors})
      } else {
        resolve({success: true})
      }
    })
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
              uploadGame(data.game)
            } else if (data.gameID) {
              console.log(`match_complete and gameID ${data.gameID} but no game data`)
              if (gameAlreadyUploaded(data.gameID)) {
                if (gameLookup[data.gameID].count++ > 5) {
                  if (!gameLookup[data.gameID].uploaded) {
                    gameLookup[data.gameID].uploaded = true
                    if (lastGameState) {
                      uploadGame(lastGameState)
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
                const deck = getDeckById(data.deck_id);
                appData.activeDeck = data.deck_id;
                const types = ['daily','alltime'];
                $.each(types, (i, type) => {
                  if (!(data.deck_id in appData.winLossObj[type])){
                    appData.winLossObj[type][appData.activeDeck] = {win: 0, loss: 0, name: deck.pool_name};
                  }
                });
                appData.deckWinCounter = appData.winLossObj['alltime'][data.deck_id].win;
                appData.deckLossCounter = appData.winLossObj['alltime'][data.deck_id].loss;
                appData.dailyDeckWinCounter = appData.winLossObj['daily'][data.deck_id].win;
                appData.dailyDeckLossCounter = appData.winLossObj['daily'][data.deck_id].loss;
                appData.showDeckCounters = true;

              } else {
                appData.activeDeck = 'total';
                appData.deckWinCounter = 0;
                appData.deckLossCounter = 0;
                appData.dailyDeckWinCounter = 0;
                appData.dailyDeckLossCounter = 0;
                appData.showDeckCounters = false;
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
        if (data.right_click && !debug) {
            hideWindow()
        } else if (data.draft_collection_count) {
          console.log("handle draft stuff")
          console.log(data.draft_collection_count)

          appData.game_in_progress = false;
          appData.show_available_decklists = false;
          appData.showDraftStats = true;

          appData.draftStats = data.draft_collection_count
        } else if (data.rank_change) {
          passThrough("rankChange", data.rank_change, data.player_key).catch(e => {
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

            ipcRenderer.send("lastVaultProgressChanged",appData.lastVaultProgress)
          }
          //console.log(data.inventory)
          ipcRenderer.send('inventoryChanged', data.inventory)
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
                ipcRenderer.send('recentCardsChanged', objectToPush)
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
          passThrough("draft-pick", data.draftPick, data.player_key).catch(e => {
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
            appData.player_decks = new_decks.sort((a,b) => {
              if (a.pool_name < b.pool_name ){
                return -1;
              } else if ( a.pool_name === b.pool_name ){
                return 0;
              } else {
                return 1;
              }
            });
            appData.no_decks = false;
        }
    }
    resizeWindow()
}

let stepZoom = (zoomIn=true) => {
  zoom += zoomIn ? 0.1 : -0.1;
  if ( zoom < 0.2 ) {
    zoom = 0.2;
  }
  applyZoom()
}

let resetZoom = () => {
  zoom = 1
  applyZoom()
}

let applyZoom = () => {
  browserWindow.webContents.setZoomFactor(zoom)
  ipcRenderer.send('settingsChanged', {key: "zoom", value: zoom})
}

let zoomIn = () => {
  stepZoom()
}

let zoomOut = () => {
  stepZoom(false)
}

//function to close because of coming feature: close to tray
let close = () => {
  browserWindow.close()
}

let openInspector = () => { ipcRenderer.send('openInspector', null); }
let openHistory = () => { ipcRenderer.send('openHistory', null); }
let openSettings = () => { ipcRenderer.send('openSettings', null); }
let openCollection = () => { ipcRenderer.send('openCollection', null); }

let menu_items = [
  {
    label: 'History',
    action: openHistory,
    keybind: 'Ctrl+H'
  },
   {
    label: 'Inspector',
    action: openInspector,
    keybind: 'Ctrl+I'
  },
  {
    label: 'Settings',
    action: openSettings,
    keybind: 'Ctrl+;',
    alt_keybind: 'Ctrl+S'
  },
  {
    label: 'Vault',
    action: openCollection,
    keybind: "Ctrl+V"
  },
  {
    label: 'Copy',
    action: copyData,
    keybind: 'Ctrl+C',
    separator: 'top'
  },
  {
    label: 'Zoom',
    submenu: [
      {
        label: 'Zoom in',
        action: zoomIn,
        keep_open: true,
        keybind: 'Ctrl+\+',
        alt_keybind: 'Ctrl+='
      },
      {
        label: 'Zoom out',
        action: zoomOut,
        keep_open: true,
        keybind: 'Ctrl+-',
        alt_keybind: 'Ctrl+Shift+-'
      },
      {
        label: 'Reset zoom',
        action: resetZoom,
        keep_open: true,
        keybind: 'Ctrl+0'
      },
    ],
    separator: 'bottom'
  },
  {
    label: 'Quit',
    action: close,
    keybind: 'Ctrl+Q'
  },
];

let buildMenu = () => {
  let menu = $('<ul></ul>')
  for (let menu_item of menu_items) {
    menu.append(buildMenuItem(menu_item))
  }
  $('#main-menu').append(menu)
};

let buildMenuItem = (menu_item) => {
  let li = $('<li></li>')
  let item = $('<a></a>')
  item.text(menu_item.label)

  if (menu_item.action != undefined) {
    let action = null
    if ( menu_item.keep_open ) {
      action = menu_item.action
    } else {
      action = () => { menu_item.action.call(); toggleMenu()}
    }
    item.click(action)
  }

  if (menu_item.keybind != undefined){
    let span = $('<span class="keybind">' + menu_item.keybind + '</span>')
    item.append(span)
    mousetrap.bind(menu_item.keybind.toLowerCase(),menu_item.action)
    if (menu_item.alt_keybind != undefined){
      mousetrap.bind(menu_item.alt_keybind.toLowerCase(),menu_item.action)
    }
  }

  li.append(item)

  if (menu_item.separator != undefined) {
    if (menu_item.separator == 'both' || menu_item.separator == 'top'){
      li.addClass('separator-top')
    }
    if (menu_item.separator == 'both' || menu_item.separator == 'bottom'){
      li.addClass('separator-bottom')
    }
  }

  if (menu_item.submenu != undefined) {
    let submenu = $('<ul></ul>')
    for (let submenu_item of menu_item.submenu){
      submenu.append(buildMenuItem(submenu_item))
    }
    li.append(submenu)
  }
  return li
}

let toggleMenu = () => {
  $('#main-menu').toggleClass('hide-me');
  $('body').toggleClass('no-drag');
  resizeWindow()
}

let updateTitleWidth = () => {
  let width = useMinimal ? 278 : 320
  if (appData.showHideButton) {
    width -= 26
  }
  if (appData.showUIButtons){
    width -= 50
  }
  if (appData.showMenu) {
    width -= 24
  }
  if (!(appData.showHideButton && appData.showMenu && appData.showUIButtons)){
    width -= 8
  }
  $('#tracker-header h1').css('width',width)
}

/**
 * These click handlers need to be reset on all resizeWindow calls because of DOM changes
 */

let setClickHandlers = () => {
  addClickHandler('.message-container',(e) => {dismissMessage(e.target)})
  addClickHandler('.back-draft',(e) => {exitDraft()})
  addClickHandler('.back-to-decklist',(e) => {unpopulateDecklist()})
  addClickHandler('.deck-container',(e) => {populateDeck($(e.target).parent().get(0))})
}

let hideWindow = () => {
    hideModeManager.toggleHidden()
    ipcRenderer.send('hideRequest')
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

    if (invertHideMode){
      hideWindow()
    }

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

    /**
     * These click handlers only need to be set once, so called here.
     */

    buildMenu()
    updateTitleWidth()
    addClickHandler('#menu-icon',toggleMenu)
    addClickHandler('#floating-eye',hideWindow)
    addClickHandler('#minimize-icon',() => {browserWindow.minimize()})
    addClickHandler('#close-icon',close)
    addClickHandler('body',null)

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

  showDailyTotalWinLossCounter = remote.getGlobal('showDailyTotalWinLossCounter');
  appData.showDailyTotalWinLossCounter = showDailyTotalWinLossCounter

  showDailyDeckWinLossCounter = remote.getGlobal('showDailyDeckWinLossCounter');
  appData.showDailyDeckWinLossCounter = showDailyDeckWinLossCounter

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

  minToTray = remote.getGlobal('minToTray');
  appData.minToTray = minToTray

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

  useMinimal = remote.getGlobal("useMinimal")

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
      updateTitleWidth()
    }
  } else if (currentMinimalLink) {
    currentMinimalLink.remove()
    updateTitleWidth()
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

  let buttonsChanged = false
  let fields = ['showUIButtons','showMenu','showHideButton']
  for (let field of fields) {
    let newVal = remote.getGlobal(field)
    if (newVal != appData[field]){
      appData[field] = newVal
      buttonsChanged = true
    }
  }
  if (buttonsChanged) {
    updateTitleWidth()
  }

  resizeWindow()
})

ipcRenderer.on('counterChanged', (e,new_wlc) => {
  appData.winLossObj = new_wlc;

  if (appData.activeDeck === 'total') {
      appData.deckWinCounter = 0;
      appData.deckLossCounter = 0;
      appData.dailyDeckWinCounter = 0;
      appData.dailyDeckLossCounter = 0;
      appData.showDeckCounters = false;
  } else {
    appData.deckWinCounter = appData.winLossObj.alltime[appData.activeDeck].win;
    appData.deckLossCounter = appData.winLossObj.alltime[appData.activeDeck].loss;
    if (appData.winLossObj.daily[appData.activeDeck] === undefined){
      appData.winLossObj.daily[appData.activeDeck] = {win:0,loss:0,name:getDeckById(appData.activeDeck).pool_name};
    }
    appData.dailyDeckWinCounter = appData.winLossObj.daily[appData.activeDeck].win;
    appData.dailyDeckLossCounter = appData.winLossObj.daily[appData.activeDeck].loss;
    appData.showDeckCounters = true;
  }

  appData.totalWinCounter = appData.winLossObj.alltime.total.win;
  appData.totalLossCounter = appData.winLossObj.alltime.total.loss;
  appData.dailyTotalWinCounter = appData.winLossObj.daily.total.win;
  appData.dailyTotalLossCounter = appData.winLossObj.daily.total.loss;
});

console.timeEnd('init')
