const { API_URL } = require("./js/api")
const { pagePrefix } = require("./js/conf")
const toastr = require("toastr")
window.toastr = toastr

var appData = {
  username: "unknown",
  currentDeckName: "",

  currentGameID: "loading ...",
  currentGameIsPermanent: true,
  currentGameInColdStorage: false,
  currentGameWinner: "loading ...",
  currentGameHasInfo: false,
  currentGameHasRankInfo: false,

  currentGameEvent: "",
  currentGameOnPlay: "",
  currentGameEndPhase: "",
  currentGameElapsedTime: "",
  currentGameTurnCount: -1,
  currentGameHeroRankBefore: "",
  currentGameHeroRankAfter: "",
  currentGameHeroRankChange: 0.0,

  currentGameActionLog: [],

  currentGameName: "",
  currentGameHero: "",
  currentGameHeroDeck: [],
  currentGameHeroDeckName: "loading ...",
  currentGameHeroDeck: "loading ...",
  currentGameOpponent: "",
  currentGameOpponentDeck: [],
  currentGameOpponentDeckName: "loading ...",
  currentGameOpponentRank: "loading ...",


  homeDeckOffset: 0,
  fullHomeDeckList: [],
  homeDeckList: [],
  homeGameList: [],
  homeGameListPage: 1,
  winLossColors: [0, 0, 0, 0, 0],
  winLossColorChart: null,
  bound: null,
  pagePrefix: pagePrefix,

  overallWinLoss: [0,0],
  overallWinLossChart: null,

  overallWinLossByEvent: [],
  overallWinLossByEventChart: null,

  playerEventHistoryChart: null,

  totalGamesPlayed: "loading...",
  totalDecks: "loading...",
  totalTimeSeconds: "loading...",
  longestGameLengthSeconds: "loading...",
  averageGameLengthSeconds: "loading...",

  API_URL: API_URL,
  clientVersionData: [0,0],
  clientVersionChart: null,
}

var rightClickPosition;

const { remote, ipcRenderer, shell } = require('electron')
const { Menu, MenuItem } = remote

const contextMenu = new Menu()
const contextMenuItem = new MenuItem({
  label: 'Inspect Element',
  click: () => {
    remote.getCurrentWindow().inspectElement(rightClickPosition.x, rightClickPosition.y)
  }
})
contextMenu.append(contextMenuItem)
window.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    rightClickPosition = {x: e.x, y: e.y}
    contextMenu.popup(remote.getCurrentWindow())
}, false)

// do this very first to try to avoid FouC
let darkModeEnabled = localStorage.getItem("dark-mode") == "true" || false;
let enableDarkMode = (noTransition) => {
    if (noTransition) {
      $(".themeable").addClass("notransition")
    }
    $(".themeable").addClass("dark-mode")
    if (appData.winLossColorChart) {
        appData.winLossColorChart.options.scales.yAxes[0].gridLines.color = "#5d5d5d"
        appData.winLossColorChart.options.scales.xAxes[0].gridLines.color = "#5d5d5d"
        appData.winLossColorChart.options.scales.yAxes[0].ticks.fontColor = "#dedede"
        appData.winLossColorChart.options.scales.xAxes[0].ticks.fontColor = "#dedede"
        appData.winLossColorChart.options.title.fontColor = "#dedede"
        appData.winLossColorChart.data.datasets[0].backgroundColor = ["#005429", "#004ba5", "#940400", "#8c8c51", "#6d6d6d"]
        appData.winLossColorChart.update()
    }
    enableDarkModeDonutChart(appData.clientVersionChart)
    enableDarkModeDonutChart(appData.overallWinLossChart)
    enableDarkModeBarChart(appData.overallWinLossByEventChart)
    if (appData.playerEventHistoryChart) {
        appData.playerEventHistoryChart.options.scales.yAxes[0].gridLines.color = "#5d5d5d"
        appData.playerEventHistoryChart.options.scales.xAxes[0].gridLines.color = "#5d5d5d"
        appData.playerEventHistoryChart.options.legend.labels.fontColor = "#dedede"
        appData.playerEventHistoryChart.update()
    }
    $(".themeable").removeClass("notransition")
    setTimeout(function() {
      // after it has been long enough for any transitions to complete, flip the toggle
      // in case this is the first load, and the toggle is blank
      $("#dark-mode").prop("checked", true)
    }, 300)
}

let disableDarkModeDonutChart = (chart) => {
    if (chart) {
        chart.options.title.fontColor = "#474747"
        chart.options.legend.labels.fontColor = "#474747"
        chart.data.datasets[0].borderColor = "#eee"
        chart.update()
    }
}

let enableDarkModeDonutChart = (chart) => {
    if (chart) {
        chart.options.title.fontColor = "#dedede"
        chart.options.legend.labels.fontColor = "#dedede"
        chart.data.datasets[0].borderColor = "#333"
        chart.update()
    }
}

let disableDarkModeBarChart = (chart) => {
    if (chart) {
        chart.options.title.fontColor = "#474747"
        chart.options.legend.labels.fontColor = "#474747"
        chart.data.datasets.forEach(dataset => dataset.borderColor = "#eee")
        chart.options.scales.xAxes[0].ticks.fontColor = "#474747"
        chart.update()
    }
}

let enableDarkModeBarChart = (chart) => {
    if (chart) {
        chart.options.title.fontColor = "#dedede"
        chart.options.legend.labels.fontColor = "#dedede"
        chart.data.datasets.forEach(dataset => dataset.borderColor = "#333")
        chart.options.scales.xAxes[0].ticks.fontColor = "#dedede"
        chart.update()
    }
}

window.enableDarkMode = enableDarkMode;
let disableDarkMode = () => {
    $(".themeable").removeClass("dark-mode")
    if (appData.winLossColorChart) {
        appData.winLossColorChart.options.scales.yAxes[0].gridLines.color = "#d5d5d5"
        appData.winLossColorChart.options.scales.xAxes[0].gridLines.color = "#d5d5d5"
        appData.winLossColorChart.options.scales.xAxes[0].ticks.fontColor = "#696969"
        appData.winLossColorChart.options.scales.yAxes[0].ticks.fontColor = "#696969"
        appData.winLossColorChart.options.title.fontColor = "#696969"
        appData.winLossColorChart.data.datasets[0].backgroundColor = ["#c4d3ca", "#b3ceea", "#e47777", "#f8e7b9", "#a69f9d"]
        appData.winLossColorChart.update()
    }
    disableDarkModeDonutChart(appData.clientVersionChart)
    disableDarkModeDonutChart(appData.overallWinLossChart)
    disableDarkModeBarChart(appData.overallWinLossByEventChart)
    if (appData.playerEventHistoryChart) {
        appData.playerEventHistoryChart.options.scales.yAxes[0].gridLines.color = "#d5d5d5"
        appData.playerEventHistoryChart.options.scales.xAxes[0].gridLines.color = "#d5d5d5"
        appData.playerEventHistoryChart.options.legend.labels.fontColor = "#696969"
        appData.playerEventHistoryChart.update()
    }
}
let toggleDarkMode = () => {
    darkModeEnabled = !darkModeEnabled
    localStorage.setItem("dark-mode", darkModeEnabled)
    if (darkModeEnabled) {
      enableDarkMode()
    } else {
      disableDarkMode()
    }
}
window.toggleDarkMode = toggleDarkMode

// https://stackoverflow.com/questions/46041831/copy-to-clipboard-with-break-line
function clipboardCopy(text) {
    var input = document.createElement('textarea');
    input.innerHTML = text;
    document.body.appendChild(input);
    input.select();
    var result = document.execCommand('copy');
    document.body.removeChild(input)
    return result;
}

function exportDeck(deck, sideboard=null) {
    let result = "";
    if (deck && typeof deck === 'object' && deck.constructor === Array) {
         deck.forEach(cardObj => {
           if (typeof cardObj == "number" || typeof cardObj == "string") {
             let card = cardUtils.allCards.findCard(cardID)
             result += `1 ${card.get("prettyName")} (${card.get("set")}) ${card.get("setNumber")}` + "\n"
           } else if (cardObj.count) {
             result += `${cardObj.count} ${cardObj.name} (${cardObj.set}) ${cardObj.setNumber}` + "\n"
           }
         })
    }
    if (sideboard && typeof sideboard === 'object' && sideboard.constructor === Array && sideboard.length > 0) {
         result += "\n"
         sideboard.forEach(cardObj => {
           if (typeof cardObj == "number" || typeof cardObj == "string") {
             let card = cardUtils.allCards.findCard(cardID)
             result += `1 ${card.get("prettyName")} (${card.get("set")}) ${card.get("setNumber")}` + "\n"
           } else if (cardObj.count) {
             result += `${cardObj.count} ${cardObj.name} (${cardObj.set}) ${cardObj.setNumber}` + "\n"
           }
         })
    }
    clipboardCopy(result)
    toastr.info("Deck Exported to Clipboard")
}

function exportDraft(draft) {
    let result = "";

    result += "Event #: 1" + "\n"
    result += "Time:    1/1/2018 1:11:11 PM" + "\n"
    result += "Players:" + "\n"
    result += "--> me" + "\n"
    result += "    bot" + "\n"
    result += "    bot" + "\n"
    result += "    bot" + "\n"
    result += "    bot" + "\n"
    result += "    bot" + "\n"
    result += "    bot" + "\n"
    result += "    bot" + "\n"
    result += "\n"

    if (draft && typeof draft === 'object' && draft.picks && draft.picks.constructor === Array) {

        draft.picks.forEach(event => {
          let card = cardUtils.allCards.findCard(event.pick)


          if (event.pickNumber == 0) {
            result += "------ " + card.get("set") + " ------" + "\n"
            result += "\n"
          }

          result += "Pack "+(event.packNumber+1)+ " pick "+(event.pickNumber+1)+ ":\n"

          event.pack.forEach(cardno => {
            let preamble = "    "
            let ocard = cardUtils.allCards.findCard(cardno)
            if (cardno == event.pick) {
              preamble = "--> "
            }
            result += preamble + ocard.get("prettyName") + "\n"

          })


          result += "\n"
        })


    }

    clipboardCopy(result)
    toastr.info("Draft Exported to Clipboard")
}

window.exportDeck = exportDeck

if (localStorage.getItem("dark-mode") == "true") enableDarkMode(true)

const cardUtils = require('mtga')
window.cardUtils = cardUtils

//var page = require('page')
//window.page = page
var spaRouter = require('./js/spaRouter')

const { getGames, hideDeck, unHideDeck } = require('./js/api')

window.appData = appData

rivets.formatters.humanseconds = (value) => {
  try {
    let days = 0
    let hours = 0
    let minutes = 0
    let seconds = 0

    let minute_seconds = 60
    let hour_seconds = minute_seconds * 60
    let day_seconds = hour_seconds * 24

    while (value > hour_seconds) {
      hours += 1
      value -= hour_seconds
    }
    while (value > minute_seconds) {
      minutes += 1
      value -= minute_seconds
    }
    seconds = value.toFixed(2)

    value = ""
    if (days) {
      value += `${days} days, `
    } if (hours) {
      value += `${hours} hours, `
    } if (minutes) {
      value += `${minutes} minutes, `
    }
    value += `${seconds} seconds`
    return value
  } catch (error) {
    console.log(error)
    return value;
  }
}

rivets.binders.expandevent = function(el, value) {
  for (let eventText of value) {
    if (typeof eventText == "string") {
      eventText = {"text": eventText, "type": "text"}
    }
    let span = document.createElement('span')
    span.innerHTML = eventText.text;
    span.classList.add(eventText.type)
    span.classList.add("themeable")
    if (eventText.hover) {
     span.setAttribute("data-toggle", "tooltip")
     span.setAttribute("title", eventText.hover)
    }
    el.appendChild(span)
    if (eventText.type == "game") {
      let hr = document.createElement("hr")
      el.appendChild(hr)
    }
  }
}

rivets.binders.multimana = (el, value) => {
  el.innerHTML = "";
  let ih = ""
  if (value === undefined)
    value = []
  value.forEach(val => {
    if (val == "Blue") val = "u"
    val = val[0].toLowerCase()
    if (val != "c") {
      ih += `<i class="mi mi-mana mi-shadow mi-${val}"></i>`
    }
  })
  el.innerHTML = ih;
}

rivets.binders.rarity = (el, value) => {
    el.classList.remove("rare")
    el.classList.remove("mythic")
    el.classList.remove("uncommon")
    el.classList.remove("common")
    value = value.toLowerCase().split(" ")[0]

    el.classList.add(value)
}

rivets.binders.mana = function(el, value) {
    if (value == "Blue") value = "u"
    value = value[0].toLowerCase()
    let mi_class = "mi-" + value.toLowerCase()
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

rivets.binders.typecount = function(el, val) {
  let expectedType = $(el).attr("type-check")
  let total = 0;
  val.forEach(card => {
    if (card.cardType == expectedType) {
      total += card.count;
    }
  })
  $(el).html($(el).html().split(" ")[0] + ` &mdash; ${total}`)
  if (total) {
    el.style.display = 'block'
  } else {
    el.style.display = 'none'
  }
}

rivets.binders.hideifnotcorrecttype = function(el, val) {
  let expectedType = $(el).attr("type-check")
  if (val != expectedType) {
    el.style.display = 'none'
  }
}

rivets.binders.linegame = function(el, val) {
  $(el).removeClass("danger").removeClass("success")
  if (val) {
    if (!val.won) {
      $(el).addClass("danger")
      el.innerHTML = '<i class="fa fa-times-circle"></i>'
    } else {
      $(el).addClass("success")
      el.innerHTML = '<i class="fa fa-check-circle"></i>'
    }
  }
}

rivets.binders.hidedeck = function(el, deckid) {
  console.log("attempting to bind...")
  $(el).click(function() {
    console.log("sliding up: " + '[deckid="' + deckid + '"]')
    $('[deckid="' + deckid + '"]').slideUp()
    hideDeck(deckid, el)
  })
}

rivets.binders.softhidedeck = function(el, deckid) {
  $(el).unbind("click")
  $(el).click(function() {
    console.log("softhiding deck " + deckid)
    hideDeck(deckid, el)
  })
}

rivets.binders.unhidedeck = function(el, deckid) {
  $(el).unbind("click")
  $(el).click(function() {
    console.log("softhiding deck " + deckid)
    unHideDeck(deckid, el)
  })
}

//Loads the correct sidebar on window load,
//collapses the sidebar on window resize.
// Sets the min-height of #page-wrapper to window size
$(function() {
    // load both menu templates

    $("#top-menu").load(`${pagePrefix}/templates/top-menu-inner.html?v=1.3.0`, loaded => {
        $("#side-menu").load(`${pagePrefix}/templates/side-menu-inner.html?v=1.3.0`, loaded => {
            // this will catch homepage links, but we still need to add page.js middleware in spaRouter
            $("a").click(e => {
              window.scrollTo(0,0);
            })

            if (localStorage.getItem("dark-mode") == "true") enableDarkMode(true)

            $('#side-menu').metisMenu();
            // TODO: get a username from somewhere
//            $("#username").val(username)
//            appData.username = username;
            $(window).bind("load resize", function() {
                var topOffset = 50;
                var width = (this.window.innerWidth > 0) ? this.window.innerWidth : this.screen.width;
                if (width < 768) {
                    $('div.navbar-collapse').addClass('collapse');
                    topOffset = 100; // 2-row-menu
                } else {
                    $('div.navbar-collapse').removeClass('collapse');
                }

                var height = ((this.window.innerHeight > 0) ? this.window.innerHeight : this.screen.height) - 1;
                height = height - topOffset;
                if (height < 1) height = 1;
                if (height > topOffset) {
                    $("#page-wrapper").css("min-height", (height) + "px");
                }
            });

            var url = window.location;
            var element = $('ul.nav a').filter(function() {
                return this.href == url;
            }).addClass('active').parent();

            while (true) {
                if (element.is('li')) {
                    element = element.parent().addClass('in').parent();
                } else {
                    break;
                }
            }
        })
    })
});
