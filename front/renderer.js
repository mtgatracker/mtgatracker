console.time('init')

//wait for loaded event
// TODO: where did ^this comment come from? what does it mean?
const https = require('https');
const http = require('http');
const request = require('request');

let { remote } = require('electron')
let win = remote.getCurrentWindow()
var debug = remote.getGlobal('debug');

var appData = {
    deck_name: "loading...",
    cant_connect: false,
    last_connect: 0,
    last_connect_as_seconds: 0,
    total_cards_in_deck: "0",
    draw_stats: []
}
rivets.bind(document.getElementById('container'), appData)

// TODO: finish this
rivets.binders.card_color = function(el, value) {
  el.classList.remove("card-b")
  el.classList.remove("card-bw")
  el.classList.remove("card-g")
  el.classList.remove("card-r")
  el.classList.remove("card-w")
  el.classList.remove("card-u")
  el.classList.remove("card-c")
  console.log("binding ", value, " to ", el)
  if (value.includes("Black")) {
    if (value.includes("White")) {
        el.classList.add("card-bw")
    } else {
        el.classList.add("card-b")
    }
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

var updateData = function(currentUpdateInterval) {
    request.get({
        url: "http://localhost:8080/",
        json: true,
        headers: {'User-Agent': 'request'}
      }, (err, res, data) => {
        if (err) {
          appData.cant_connect = true;
          appData.last_connect += currentUpdateInterval;
          appData.last_connect_as_seconds = appData.last_connect / 1000;
          currentUpdateInterval = Math.min(currentUpdateInterval + 100, 3000)
          console.log('Error:', err, " backing off to ", currentUpdateInterval, " / ");
          setTimeout(function() {
            updateData(currentUpdateInterval);
          }, currentUpdateInterval);
        } else if (res.statusCode !== 200) {
          appData.cant_connect = true;
          appData.last_connect += currentUpdateInterval;
          appData.last_connect_as_seconds = appData.last_connect / 1000;
          console.log('Status: ', res.statusCode);
          setTimeout(function() {
            updateData(currentUpdateInterval);
          }, currentUpdateInterval);
        } else {
          appData.cant_connect = false;
          appData.last_connect = 0;
          appData.last_connect_as_seconds = 0;
          // data is already parsed as JSON:
          console.log(data);
          if (data.stats) {
            console.log("updated")
            appData.draw_stats = data.stats;
            appData.deck_name = data.deck_name;
            appData.total_cards_in_deck = data.total_cards_in_deck;
          } else {
            console.log("not updating yet.")
          }

          setTimeout(function() {
            updateData(1000); // reset failure wait to 1000
          }, 500); // but on success poll hard
        }
    });
    var total = 0;
    $.each($(".card"), function(i, c) {
        total += c.offsetHeight;
    })
    console.log("offsetHeight", total)
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

// kick off the setTimeout loop. I HATE THIS. setInterval feels way more appropriate,
// but The Internet says this is the right way. so.
updateData(1000);

console.timeEnd('init')

