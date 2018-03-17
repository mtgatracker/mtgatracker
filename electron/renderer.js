console.time('init')

//wait for loaded event
// TODO: where did ^this comment come from? what does it mean?
const https = require('https')
const http = require('http')

const ReconnectingWebSocket = require('./rws.js')
const fs = require('fs')

let { remote } = require('electron')
let browserWindow = remote.getCurrentWindow()

window.addEventListener('beforeunload', function() {
    ws.send("die")
})

var debug = remote.getGlobal('debug');
var showIIDs = remote.getGlobal('showIIDs');

var ws = new ReconnectingWebSocket("ws://127.0.0.1:5678/", null, {constructor: WebSocket})

var appData = {
    deck_name: "loading...",
    cant_connect: false,
    show_error: false,
    last_error: "",
    error_count: 0,
    debug: debug,
    show_iids: showIIDs,
    last_connect: 0,
    last_connect_as_seconds: 0,
    total_cards_in_deck: "0",
    draw_stats: [],
    opponent_hand: [],
}

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
    el.classList.add(mi_class)
}

// TODO: finish this
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
    console.log("called formatter!")
    return value / 100;
}

var setAppData = function() {
    console.log("called setAppData")
    console.log(appData)
}

let all_hidden = false;
var hideTimeoutId;

var updateOpacity = function() {
    if (all_hidden) {
        console.log("hide", all_hidden)
        document.getElementById("container").style.opacity = "0.1";
    } else {
        console.log("unhide", all_hidden)
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


ws.onmessage = (data) => {
    // data is already parsed as JSON:
    data = JSON.parse(event.data)
    console.log("hello onmessage")
    console.log(data);

    if(data.data_type == "game_state") {

        appData.draw_stats = data.draw_odds.stats;
        appData.deck_name = data.draw_odds.deck_name;
        appData.total_cards_in_deck = data.draw_odds.total_cards_in_deck;
        appData.opponent_hand = data.opponent_hand
        var total = 0;
        $.each($(".card"), function(i, c) {
            total += c.offsetHeight;
        })

        container = document.getElementById("container")
        starting_height = 118;
        current_height = $(container).height();
        new_height = starting_height + total
        container.style.height = "" + new_height + "px";
        bounds = browserWindow.getBounds()
        win_offset = 30;
        bounds.height = new_height + win_offset;
        if (!debug) {
            browserWindow.setBounds(bounds)
        }
    } else if (data.data_type == "message") {
        console.log("got message:")
        console.log(data)
        if (data.count) {
            appData.error_count = data.count;
        }
        appData.last_error = data.msg;
        appData.show_error = true;
    }
}

console.timeEnd('init')