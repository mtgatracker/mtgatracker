console.time('init')

//wait for loaded event
// TODO: where did ^this comment come from? what does it mean?
const https = require('https');
const http = require('http');
const request = require('request');

let { remote } = require('electron')
let win = remote.getCurrentWindow()
var debug = remote.getGlobal('debug');
var ws = remote.getGlobal('ws');

var appData = {
    deck_name: "loading...",
    cant_connect: false,
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
  el.classList.remove("card-bw")
  el.classList.remove("card-m")
  el.classList.remove("card-g")
  el.classList.remove("card-r")
  el.classList.remove("card-w")
  el.classList.remove("card-u")
  el.classList.remove("card-c")

  if (value.includes("Black") && value.includes("White")) {
        el.classList.add("card-bw")
        el.classList.add("card-m")
  } else if (value.includes("Black")) {
    el.classList.add("card-b")
  } else if (value.includes("White")) {
    el.classList.add("card-w")
  } else if (value.includes("Blue")) {
    el.classList.add("card-u")
  } else if (value.includes("Green")) {
    el.classList.add("card-g")
  } else if (value.includes("Red")) {
    el.classList.add("card-r")
  } else if (value.includes("Colorless")) {
    el.classList.add("card-c")
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

ws.onmessage = function (event){
    appData.cant_connect = false;
    appData.last_connect = 0;
    appData.last_connect_as_seconds = 0;
    // data is already parsed as JSON:
    data = JSON.parse(event.data)
    console.log(data);
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
    bounds = win.getBounds()
    win_offset = 30;
    bounds.height = new_height + win_offset;
    if (!debug) {
        win.setBounds(bounds)
    }
}

console.timeEnd('init')