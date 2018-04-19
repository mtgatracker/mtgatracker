console.time('init')

const request = require("request")

const ReconnectingWebSocket = require('./vendor/rws.js')
const fs = require('fs')

let { remote } = require('electron')
let browserWindow = remote.getCurrentWindow()

window.addEventListener('beforeunload', function() {
    ws.send("die")
})

var debug = remote.getGlobal('debug');
var useFrame = remote.getGlobal('useFrame');
var showIIDs = remote.getGlobal('showIIDs');
var appVersionStr = remote.getGlobal('version');
var zoom = 0.8;

var ws = new ReconnectingWebSocket("ws://127.0.0.1:5678/", null, {constructor: WebSocket})

var appData = {
    deck_name: "loading...",
    cant_connect: false,
    show_error: false,
    show_update_message: false,
    last_error: "",
    error_count: 0,
    debug: debug,
    show_iids: showIIDs,
    last_connect: 0,
    last_connect_as_seconds: 0,
    game_in_progress: false,
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

// TODO: DRY here and @ webtasks/on_demand/mtga-tracker-game.js
// check for a newer release
request.get({
    url: "https://api.github.com/repos/shawkinsl/mtga-tracker/releases/latest",
    json: true,
    headers: {'User-Agent': 'MTGATracker-App'}
}, (err, res, data) => {
    const latestVersion = parseVersionString(data.tag_name);
    const appVersion = parseVersionString(appVersionStr);
    if (version != latestVersion) {
        // TODO: if major version bits do not match, stop operation of app
        // https://github.com/shawkinsl/mtga-tracker/issues/129
        if (appVersion.major != latestVersion.major || appVersion.medium != latestVersion.medium) {
            console.log("no match, major or medium")
            appData.message = `A new version (${data.tag_name}) is available!`;
            appData.show_update_message = true;
        } else if (latestVersion.suffix === undefined && appVersion.suffix !== undefined) {
            appData.message = `A new version (${data.tag_name}) is available!`;
            appData.show_update_message = true;
            console.log("no match, suffix")
        } else {
            console.log("close enough")
        }
    }
})

rivets.bind(document.getElementById('container'), appData)

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

let all_hidden = false;
var hideTimeoutId;

var updateOpacity = function() {
    if (all_hidden) {
        document.getElementById("container").style.opacity = "0.1";
    } else {
        document.getElementById("container").style.opacity = "1";
        if (hideTimeoutId) {
            clearTimeout(hideTimeoutId)
            hideTimeoutId = null;
        }
    }
}

document.getElementById("floating-eye").addEventListener("click", function() {
    all_hidden = !all_hidden;
    updateOpacity();
    if (hideTimeoutId) {
        clearTimeout(hideTimeoutId)
        hideTimeoutId = null;
    }
    hideTimeoutId = setTimeout(function() {
        all_hidden = false;
        updateOpacity()
    }, 10000)
})

ws.addEventListener('open', () => {
    ws.send('hello!');
    console.log("sent hello")
    ws.addEventListener('message', (m) => {
        console.log(m)
    })
});


function resizeWindow() {
    let total = 0;
    $.each($(".card"), function(i, c) {
        total += c.offsetHeight;
    })

    container = document.getElementById("container")

    let totalHeight = 10;

    $("#container").children().each(function(c, e) {
        if(e.style.display != "none")
            totalHeight += $(e).outerHeight(true);
    });
    bounds = browserWindow.getBounds()
    bounds.height = parseInt(totalHeight);
    container.style.height = "" + parseInt(totalHeight) + "px"
    if (!debug) {
        browserWindow.setBounds(bounds)
    } else {
        // console.log("would set height: " + totalHeight)
    }
}

function populateDeck(elem) {
    deckID = elem.getAttribute('data-deckid')
    $.each(appData.player_decks, (i, v) => {
        if (v.deck_id == deckID) {
            appData.selected_list = v.cards;
            appData.selected_list_name = v.pool_name;
            appData.list_selected = true;
            appData.no_list_selected = false;
        }
    })
    resizeWindow()
}

function unpopulateDecklist() {
    appData.list_selected = false;
    appData.no_list_selected = true;
    appData.show_available_decklists = true;
    appData.game_in_progress = false;
    resizeWindow()
}


ws.onmessage = (data) => {
    // data is already parsed as JSON:
    data = JSON.parse(event.data)
    if(data.data_type == "game_state") {
        if (data.match_complete) {
            console.log("match over")
            appData.game_complete = true;
        } else {
            appData.game_in_progress = true;
            appData.game_complete = false;
            appData.show_available_decklists = false;
            appData.draw_stats = data.draw_odds.stats;
            appData.deck_name = data.draw_odds.deck_name;
            appData.total_cards_in_deck = data.draw_odds.total_cards_in_deck;
            appData.opponent_hand = data.opponent_hand
        }

    } else if (data.data_type == "error") {
        if (data.count) {
            appData.error_count = data.count;
        }
        appData.last_error = data.msg;
        appData.show_error = true;
    } else if (data.data_type == "message") {
        // TODO
    } else if (data.data_type=="decklist_change") {
        console.log("got a dl change")
        if (data.decks.no_decks_defined) {
            appData.no_decks = true;
        } else {
            new_decks = []
            $.each(data.decks, (key, value) => {
                console.log(key)
                console.log(value)
                new_decks.push(value)
            })
            appData.player_decks = new_decks;
            appData.no_decks = false;
            console.log("got decks safvace")
        }
    }
    resizeWindow()
}

document.addEventListener("DOMContentLoaded", function(event) {
    if (debug || useFrame) {
        $("#container").addClass("container-framed")
        $("body").css("background-color", "green")
    } else {
        $("#container").addClass("container-normal")
    }
    $(".zoom-out").click(() => {
        zoom -= 0.1
        browserWindow.webContents.setZoomFactor(zoom)
    })
    $(".zoom-in").click(() => {
        zoom += 0.1
        browserWindow.webContents.setZoomFactor(zoom)
    })
    const shell = require('electron').shell;
    //open links externally by default
    $(document).on('click', 'a[href^="http"]', function(event) {
        event.preventDefault();
        shell.openExternal(this.href);
    });
});

console.timeEnd('init')