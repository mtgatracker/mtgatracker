const { remote, ipcRenderer, shell } = require('electron')
const {dialog, Menu, MenuItem,} = remote
const fs = require('fs')

const API_URL = remote.getGlobal("API_URL")
const keytar = require('keytar')
const mtga = require('mtga')
const path = require('path')
const os = require('os')
const jwt = require('jsonwebtoken')
const request = require('request')

var { rendererPreload } = require('electron-routes');
rendererPreload();

var { databaseFiles } = require("./conf")

let desktopPath = path.join(os.homedir(), 'Desktop')

const tt = require('electron-tooltip')
tt({
  position: 'top',
  style: {
    backgroundColor: 'dark gray',
    color: 'white',
    borderRadius: '4px',
  }
})

var buildWorker = function(func) {
  // https://stackoverflow.com/questions/5408406/web-workers-without-a-separate-javascript-file
  var blobURL = URL.createObjectURL(new Blob([ '(', func.toString(), ')()' ], { type: 'application/javascript' })),

  worker = new Worker(blobURL);

  // Won't be needing this anymore
  URL.revokeObjectURL(blobURL);
  return worker
}

var settingsData = {
  version: remote.getGlobal("version"),
  commit: "",
  build: "",
  logPath: remote.getGlobal("logPath"),
  version: remote.getGlobal("version"),
  mtgaOverlayOnly: remote.getGlobal("mtgaOverlayOnly"),
  settingsPaneIndex: remote.getGlobal("settingsPaneIndex"),
  debug: remote.getGlobal('debug'),
  showErrors: remote.getGlobal('showErrors'),
  showInspector: remote.getGlobal('showInspector'),
  incognito: remote.getGlobal('incognito'),
  useFrame: remote.getGlobal('useFrame'),
  staticMode: remote.getGlobal('staticMode'),
  useTheme: remote.getGlobal('useTheme'),
  themeFile: remote.getGlobal('themeFile'),
  mouseEvents: remote.getGlobal('mouseEvents'),
  leftMouseEvents: remote.getGlobal('leftMouseEvents'),
  showTotalWinLossCounter: remote.getGlobal('showTotalWinLossCounter'),
  showDeckWinLossCounter: remote.getGlobal('showDeckWinLossCounter'),
  showDailyTotalWinLossCounter: remote.getGlobal('showDailyTotalWinLossCounter'),
  showDailyDeckWinLossCounter: remote.getGlobal('showDailyDeckWinLossCounter'),
  winLossObj: remote.getGlobal('winLossCounter'),
  counterDeckList: [],
  dailyCounterDeckList: [],
  totalWinLossCounter: null,
  dailyTotalWinLossCounter: null,
  lastCollection: remote.getGlobal('lastCollection'),
  lastCollectionCount: "loading...",
  lastCollectionSetProgress: [{name: "loading..."}],
  lastVaultProgress: remote.getGlobal('lastVaultProgress'),
  showVaultProgress: remote.getGlobal('showVaultProgress'),
  minVaultProgress: remote.getGlobal('minVaultProgress'),
  showGameTimer: remote.getGlobal('showGameTimer'),
  showChessTimers: remote.getGlobal('showChessTimers'),
  hideDelay: remote.getGlobal('hideDelay'),
  invertHideMode: remote.getGlobal('invertHideMode'),
  rollupMode: remote.getGlobal('rollupMode'),
  recentCards: remote.getGlobal('recentCards'),
  recentCardsQuantityToShow: remote.getGlobal('recentCardsQuantityToShow'),
  minToTray: remote.getGlobal('minToTray'),
  runFromSource: remote.getGlobal('runFromSource'),
  sortMethodSelected: remote.getGlobal('sortMethod'),
  useFlat: remote.getGlobal('useFlat'),
  useMinimal: remote.getGlobal('useMinimal'),
  updateDownloading: remote.getGlobal('updateDownloading'),
  updateReady: remote.getGlobal('updateReady'),
  firstRun: remote.getGlobal('firstRun'),
  trackerID: remote.getGlobal('trackerID'),
  customStyleFiles: [],
  sortingMethods: [
    {id: "draw", text: "Draw (Default)", help: "By likelihood of next draw with most likely on top, then by name."},
    {id: "emerald", text: 'Emerald',
    help: "By card type, then by cost, then by name."},
    {id: "color", text: "Color",
    help: "By cost, then by color, then by name. This is similar to MTGA sorting."},
    {id: "draw-emerald", text: "Draw, Emerald",
    help: "By likelihood of next draw, then by card type, then by cost, then by name."},
    {id: "draw-color", text: "Draw, Color",
    help: "By likelihood of next draw, then by cost, then by color, then by name."},
  ],
  showUIButtons: remote.getGlobal('showUIButtons'),
  showHideButton: remote.getGlobal('showHideButton'),
  showMenu: remote.getGlobal('showMenu')
}

settingsData.counterDeckList = counterDecks(settingsData.winLossObj.alltime);
settingsData.dailyCounterDeckList = counterDecks(settingsData.winLossObj.daily);
settingsData.totalWinLossCounter = settingsData.winLossObj.alltime.total;
settingsData.dailyTotalWinLossCounter = settingsData.winLossObj.daily.total;

let commitFile = "version_commit.txt"
let buildFile = "version_build.txt"

if (!settingsData.runFromSource) {
  commitFile = path.join(remote.app.getAppPath(), commitFile)
  buildFile = path.join(remote.app.getAppPath(), buildFile)
}

fs.readFile(commitFile, "utf8", (err, data) => {
  settingsData.commit = data;
})

fs.readFile(buildFile, "utf8", (err, data) => {
  settingsData.build = data;
})

const menu = new Menu()
const menuItem = new MenuItem({
  label: 'Inspect Element',
  click: () => {
    remote.getCurrentWindow().inspectElement(rightClickPosition.x, rightClickPosition.y)
  }
})
menu.append(menuItem)

if (settingsData.debug) {
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    rightClickPosition = {x: e.x, y: e.y}
    menu.popup(remote.getCurrentWindow())
  }, false)
}

ipcRenderer.on('counterChanged', (e,new_wlc) => {
  settingsData.winLossObj = new_wlc;
  settingsData.counterDeckList = counterDecks(settingsData.winLossObj.alltime);
  settingsData.dailyCounterDeckList = counterDecks(settingsData.winLossObj.daily);
  settingsData.totalWinLossCounter = settingsData.winLossObj.alltime.total;
  settingsData.dailyTotalWinLossCounter = settingsData.winLossObj.daily.total;
});

/*
 * Format decks in winLossCounter to array for display in rivets.
 */
function counterDecks(winLossObj){
  let decks = [];
  for (let key in winLossObj){
    if (key == 'total') {
      continue;
    }
    decks.push({'id':key,'name': winLossObj[key]['name'], 'win':winLossObj[key]['win'],'loss':winLossObj[key]['loss']});
  }
  return decks.sort((a,b) => {
    if ( a.name < b.name ){
      return -1;
    } else if ( a.name == b.name ) {
      return 0;
    } else {
      return 1;
    }
  } );
}

rivets.formatters.and = function(comparee, comparator) {
    return comparee && comparator;
};

rivets.formatters.andnot = function(comparee, comparator) {
    return comparee && !comparator;
};

rivets.formatters.short = function(val) {
  if (val) {
    return val.substring(0, 6)
  }
}

rivets.formatters.filterBySlideValueRecentCards = function(arr, recentCardsQuantityToShow) {
  if(recentCardsQuantityToShow >= 100) {
    return arr;
  }
  return arr.slice(0,recentCardsQuantityToShow);
}

rivets.binders.ghlink = (el, val) => {
   el.href = `https://github.com/mtgatracker/mtgatracker/commit/${val}`
}

rivets.binders.appveyorlink = (el, val) => {
   el.href = `https://ci.appveyor.com/project/shawkinsl/mtgatracker/builds/${val}`
}

rivets.binders.settingspaneactive = (el, val) => {
  console.log("active")
  el.classList.remove("active")
  if (el.attributes.value.value == val) {
    el.classList.add("active")
  }
}

rivets.binders.showsettingspane = (el, val) => {
  el.style.display = "none"
  if (el.attributes.value.value == val) {
    el.style.display = "block"
    $(el).find(".toggle").each(function(idx, e) {e.style.width="65px"; e.style.height="40px";})  // bad dumb hack for buttons
  }
}

rivets.binders.authcolor = (el, val) => {
  el.style.color = val ? "green" : "red";
}

rivets.binders.datatooltip = (el, val) => {
  if (val) {
    el.setAttribute('data-tooltip', 'Account is authorized!');
  } else {
    el.setAttribute('data-tooltip', 'Account not authorized :(');
  }
}

rivets.binders.authref = (el, val) => {
  el.href = "https://inspector.mtgatracker.com/trackerAuth?code=" + val
}

rivets.binders.recentcardsbinder = (el, cardsObtained) => {
  var node;
  var textNode;
  var currentCard
  for(var cardID in cardsObtained) {
    currentCard = mtga.allCards.findCard(cardID)
    if(currentCard) {
      textNode = document.createTextNode(`${cardsObtained[cardID]}x ${currentCard.attributes.prettyName}`);
    } else {
      textNode = document.createTextNode(`${cardsObtained[cardID]}x card-name-not-found (${cardID})`);
    }
    node = document.createElement("li");
    node.style.webkitUserSelect = "auto";
    node.appendChild(textNode);
    el.appendChild(node);
  }
  if(Object.keys(cardsObtained).length > 0) {
    document.getElementById("no-recently-obtained-cards").style.display = "none";
  }
}

rivets.binders.deckid = function(el, value) {
  el.setAttribute('data-deckid', value);
}

rivets.binders.mythicprogress = function(el, value) {
  el.style.width = Math.max(0, (100 * value.mythicOwned / value.mythicTotal)) + "%"
}

rivets.binders.rareprogress = function(el, value) {
  el.style.width = Math.max(0, (100 * value.rareOwned / value.rareTotal)) + "%"
}

rivets.binders.uncommonprogress = function(el, value) {
  el.style.width = Math.max(0, (100 * value.uncommonOwned / value.uncommonTotal)) + "%"
}

rivets.binders.commonprogress = function(el, value) {
  el.style.width = Math.max(0, (100 * value.commonOwned / value.commonTotal)) + "%"
}

const setPromoMap = {
  RIX: "img/card_set_promos/rix.png",
  M19: "img/card_set_promos/m19.png",
  GRN: "img/card_set_promos/grn.png",
  XLN: "img/card_set_promos/xln.png",
  DAR: "img/card_set_promos/dar.png",
  ANA: "img/card_set_promos/ana.png",
}

rivets.binders.setpromo = function(el, value) {
  if (Object.keys(setPromoMap).includes(value)) {
    el.style.display = "block"
    el.src = setPromoMap[value]
  } else {
    el.style.display = "none"
  }
}

rivets.binders.hidesetname = function(el, value) {
  if (Object.keys(setPromoMap).includes(value)) {
    el.style.display = "none"
  } else {
    el.style.display = "block"
  }
}

function recentCardsSectionClickHandler(event) {
  var revealed = $(event.target).siblings(".recent-cards-container").is(":hidden");
  if(revealed) {
    $(event.target).siblings(".recent-cards-container").slideDown("fast");
  } else {
    $(event.target).siblings(".recent-cards-container").slideUp("fast");
  }
}

var firstCounterAdjButtonClicked = true;
document.addEventListener("DOMContentLoaded", function(event) {
  rivets.bind(document.getElementById('container'), settingsData)

  let collectionWorker = buildWorker(e => {
    var allCards;
    var cardSets = {}
    var playerCardCounts = {}
    onmessage = event => {
      if (event.data.allCards) {
        allCards = event.data.allCards.attributes.cards;
        // Note: this block of code looks really stupid, but trust me, it's necessary.
        // TL:DR; you can't `require(...)` inside webworkers, so we lose all of the cool mtga functionality.
        // As if that wasn't bad enough: since mtga uses backbone BS, we have to do silly things to
        // get to the actual objects within the allCards object.
        // Anyways, this block of code basically redoes all the organization that mtga originally offered in the
        // first place. :tiny_violin:
        for (let cardID in allCards) {
          let thisCard = allCards[cardID].attributes
          if (!cardSets[thisCard.set]) {
            cardSets[thisCard.set] = {
              cards: [],
              counts: {
                mythicTotal: 0,
                rareTotal: 0,
                uncommonTotal: 0,
                commonTotal: 0
              }
            }
          }
          let thisCardsSet = cardSets[thisCard.set]
          thisCardsSet.cards.push(thisCard)
          // add 4 for each unique card; you can collect 4 of each
          if (thisCard.rarity == "Mythic Rare") {
            thisCardsSet.counts.mythicTotal += 4;
          } else if (thisCard.rarity == "Rare") {
            thisCardsSet.counts.rareTotal += 4;
          } else if (thisCard.rarity == "Uncommon") {
            thisCardsSet.counts.uncommonTotal += 4;
          } else if (thisCard.rarity == "Common") {
            thisCardsSet.counts.commonTotal += 4;
          }
        }
        console.log(cardSets)
        postMessage({ready: true})
      } else if (event.data.lastCollection) {
        let total = 0;
        let unique = 0;
        let collection = event.data.lastCollection;
        console.log(Object.keys(allCards))
        for (let key in collection) {
          if (collection[key] && Number.isInteger(collection[key])) {
            if (Object.keys(allCards).includes(key)) {
              let thisCard = allCards[key].attributes
              let thisCardsSet = cardSets[thisCard.set]
              if (!Object.keys(playerCardCounts).includes(thisCard.set)) {
                playerCardCounts[thisCard.set] = thisCardsSet.counts
                playerCardCounts[thisCard.set].name = thisCard.set
                playerCardCounts[thisCard.set].mythicOwned = 0
                playerCardCounts[thisCard.set].rareOwned = 0
                playerCardCounts[thisCard.set].uncommonOwned = 0
                playerCardCounts[thisCard.set].commonOwned = 0
              }

              if (thisCard.rarity == "Mythic Rare") {
                playerCardCounts[thisCard.set].mythicOwned += collection[key];
              } else if (thisCard.rarity == "Rare") {
                playerCardCounts[thisCard.set].rareOwned += collection[key];
              } else if (thisCard.rarity == "Uncommon") {
                playerCardCounts[thisCard.set].uncommonOwned += collection[key];
              } else if (thisCard.rarity == "Common") {
                playerCardCounts[thisCard.set].commonOwned += collection[key];
              }
              playerCardCounts[thisCard.set]
            }
            total += collection[key]
            unique += 1
          }
        }

        postMessage({
          lastCollectionCount: `${unique} unique cards, ${total} total cards`,
          playerCardCounts: Object.values(playerCardCounts),
        })
      }
    }
    // for(;;) {}; // use this to loop forever, and test that hung worker doesn't make window hang
  })

  collectionWorker.onmessage = event => {
    if (event.data.lastCollectionCount) {
      settingsData.lastCollectionCount = event.data.lastCollectionCount
      settingsData.lastCollectionSetProgress = event.data.playerCardCounts
    } else if (event.data.ready) {
      collectionWorker.postMessage({lastCollection: settingsData.lastCollection})
    }
  }
  collectionWorker.postMessage({allCards: mtga.allCards})

  let themePath = settingsData.runFromSource ? "themes" : path.join("..", "themes");
  fs.readdir(themePath, (err, files) => {
    if(files) {
      files.forEach((val) => {
        if (val.endsWith(".css")) {
          settingsData.customStyleFiles.push(val)
        }
      })
    }
    $("#custom-theme-select").val(settingsData.themeFile)
  })

  $("#showTrackerID").on('click', function(event) {
    this.innerHTML = settingsData.trackerID;
  })
  $("#log-select").click(function() {
    dialog.showOpenDialog({
      properties: ["openFile"],
      defaultPath: remote.getGlobal("logPath")
    }, filePath => {
      if (filePath) {
        console.log(`next launch will read from ${filePath}`)
        settingsData.logPath = filePath
        ipcRenderer.send('settingsChanged', {key: "logPath", value: filePath[0]})
        alert("You must restart MTGATracker after changing this setting!")
      }
    })
  })
  $("#sorting-method-select").val(settingsData.sortMethodSelected)
  $(document).on('click', 'a[href^="http"]', function(event) {
      event.preventDefault();
      shell.openExternal(this.href);
  });
  $(".nav-group-item").click((e) => {
    console.log(e)
    console.log(this)
    settingsData.settingsPaneIndex = e.target.attributes.value.value
  })
  $('.tf-toggle').change(function() {
    console.log("settingsChanged")
    ipcRenderer.send('settingsChanged', {key: $(this).attr("key"), value: $(this).prop('checked')})
  })
  $('#apply-custom-theme-toggle').change(function() {
    console.log("apply theme was just toggled")
    settingsData.useTheme = $(this).prop('checked')
    let themeSelected = $("#custom-theme-select").val()
    ipcRenderer.send('settingsChanged', {key: "useTheme", value: settingsData.useTheme})
    ipcRenderer.send('settingsChanged', {key: "themeFile", value: themeSelected})
  })
  $('#enable-flat-theme-toggle').change(function() {
    console.log("apply flat theme was just toggled")
    settingsData.useFlat = $(this).prop('checked')
    ipcRenderer.send('settingsChanged', {key: "useFlat", value: settingsData.useFlat})
    if (!settingsData.useFlat) {
      settingsData.useMinimal = false;
      ipcRenderer.send('settingsChanged', {key: "useMinimal", value: settingsData.useMinimal})
    }
  })
  $('#enable-minimal-theme-toggle').change(function() {
    console.log("apply theme was just toggled")
    settingsData.useMinimal = $(this).prop('checked')
    ipcRenderer.send('settingsChanged', {key: "useMinimal", value: settingsData.useMinimal})
  })
  $("#custom-theme-select").change(function() {
    console.log("apply theme was just toggled")
    let themeSelected = $("#custom-theme-select").val()
    ipcRenderer.send('settingsChanged', {key: "useTheme", value: settingsData.useTheme})
    ipcRenderer.send('settingsChanged', {key: "themeFile", value: themeSelected})
  })
  $("#sorting-method-select").change(function() {
    console.log("sorting method was just chosen")
    let sortMethodSelected = $("#sorting-method-select").val()
    ipcRenderer.send('settingsChanged', {key: "sortMethod", value: sortMethodSelected})
  })
  $(".reset-button").click((e) => {
    const deck_id = e.target.getAttribute('data-deckid');
    const is_daily = e.target.getAttribute('data-daily') === 'true';
    const type = is_daily ? 'daily' : 'alltime';

    let message = "Are you sure you want to reset (delete) ";
    if (deck_id == 'all'){
      message += 'all ' + ( is_daily ? 'daily ' : '' ) + 'win/loss counters?';
    } else if (deck_id == 'all-decks' ){
      message += 'all ' + ( is_daily ? 'daily ' : '' ) + 'deck win/loss counters?'
    } else if (deck_id == 'total'){
      message += 'the ' + ( is_daily ? 'daily ' : '' ) + 'total win/loss counter?'
    } else {
      message += 'the ' + ( is_daily ? 'daily ' : '' ) + settingsData.winLossObj[type][deck_id].name + ' win/loss counter?';
    }
    if (!dialog.showMessageBox(remote.getCurrentWindow(), {'buttons': ['Cancel','Ok'],'message':message,})){
      return;
    }

    console.log("resetting win/loss");
    let new_wlc = settingsData.winLossObj;

    if (deck_id == 'all') {
      new_wlc[type] = {'total':{'win':0,'loss':0}};
    } else if (deck_id == 'all-decks') {
      new_wlc[type] = {'total':settingsData.winLossObj[type].total};
    } else if (deck_id == 'total'){
      new_wlc[type].total = {'win':0,'loss':0};
    } else {
      /*
        delete prop isn't working. Returns false and doesn't remove prop.
        Old technique of setting to undefined then toString back to JSON isn't working anymore either
        Until I can figure out why, here's a hack.
      */

      let decks_wlc = {};
      for ( key in settingsData.winLossObj[type] ){
        if ( key === deck_id ){
          continue;
        }
        decks_wlc[key] = settingsData.winLossObj[type][key];
      }
      new_wlc[type] = decks_wlc;
    }
    ipcRenderer.send('updateWinLossCounters', {key: 'all', value: new_wlc})
  });

  $(".counter-adj-button").click((e) => {
    /**
      * Ugly Hack Incoming!!!
      *
      * For some strange reason the first firing of this event updates the winLossObj just fine
      * as well as updating mainWindow display, however it would not update settingsWindow.
      * Any subsequent button presses (event firings, really) make the display update fine.
      * So, as a workaround, on the first click, send a change event, but post no actual changes.
      * This pushes us through the bug and lets the display update perfectly.
      */
    if (firstCounterAdjButtonClicked){
      firstCounterAdjButtonClicked = false;
      ipcRenderer.send('updateWinLossCounters', {key: 'all', value: settingsData.winLossObj})
    }

    const deck_id = e.target.getAttribute('data-deckid');
    const winloss = e.target.getAttribute('data-winloss');
    const up = e.target.getAttribute('data-direction') === 'up';
    const is_daily = e.target.getAttribute('data-daily') === 'true';
    const type = is_daily ? 'daily' : 'alltime';
    let new_wlc = {daily:settingsData.winLossObj.daily[deck_id],alltime:settingsData.winLossObj.alltime[deck_id]};
    new_wlc[type][winloss] += up ? 1 : -1;

    ipcRenderer.send('updateWinLossCounters', {key: deck_id, value: new_wlc})
  });


  $("#resetGameHistory").click((e) => {
    console.log("resetting gameHstory")
    ipcRenderer.send('clearGameHistory')
  })
  $("#backup-inspector-data").click((e) => {

    let allDatabaseFiles = Object.values(databaseFiles)
    let dbDirname = path.dirname(allDatabaseFiles[0])
    let backupDirname = path.join(dbDirname, "inspector_backups")

    if (!fs.existsSync(backupDirname)){
        fs.mkdirSync(backupDirname);
    }

    let today = new Date()
    let backupPrefix = `${today.getFullYear()}_${today.getMonth()}_${today.getDate()}_${today.getHours()}_${today.getMinutes()}_${today.getSeconds()}`

    let allWrittenPromises = []

    for (let file of allDatabaseFiles) {
      let filePath = path.parse(file)
      let backupName = `${filePath.name}-${backupPrefix}${filePath.ext}`
      let backupFile = path.join(backupDirname, backupName)
      let stream = fs.createReadStream(path.format(filePath)).pipe(fs.createWriteStream(backupFile))
      allWrittenPromises.push(new Promise((resolve, reject) => {
        stream.on("finish", resolve)
      }))
    }
    Promise.all(allWrittenPromises).then(e => alert(`Files backed up to ${backupDirname}${path.sep}inspector-<type>-${backupPrefix}.db`))
  })
  $("#collect-all-inspector-data").click((e) => {
    $("#collect-inspector-progress").css("display", "block")
    $("#collect-inspector-progress").append("<p>Authenticating with Inspector API...</p>")
    $("#collect-all-inspector-data").prop("disabled", true)
    let gameUrl = API_URL + "/tracker-api/games"
    getTrackerToken().then(tokenObj => {
      // TODO: un-callback-hell-ify this mess
      $("#collect-inspector-progress").append("<p>Success!</p>")
      $("#collect-inspector-progress").append("<hr>")
      $("#collect-inspector-progress").append("<p>Requesting game records...</p>")
      let {token} = tokenObj;
      request.get({
        url: gameUrl,
        json: true,
        headers: {'User-Agent': 'MTGATracker-App', token: token}
      }, (err, res, data) => {
        $("#collect-inspector-progress").append(`<p>Found <b>${data.docs.length}</b> records to save!</i></p>`)
        let coldStorageDocs = data.docs.filter(doc => doc.inColdStorage)
        let regularDocs = data.docs.filter(doc => doc.inColdStorage == undefined)
        $("#collect-inspector-progress").append(`<p><b>${regularDocs.length}</b> games can be added immediately, <b>${coldStorageDocs.length}</b> must be fetched from cold-storage...</p>`)
        $("#collect-inspector-progress").append(`<p>Adding <b>${regularDocs.length}</b> records to local inspector...</p>`)
        $("#collect-inspector-progress").append(`<p><i><span id="collection-game-count">Processed 0...</span></i></p>`)

        let inserted = 0;
        let alreadyThere = 0;
        let fetchURL = `insp://insert-game`

        for (let game of regularDocs) {
          game.date = new Date(Date.parse(game.date))
        }

        let insertFuncs = regularDocs.map(doc => () => fetch(fetchURL, {method: "POST", body: JSON.stringify(doc)})
            .then(resp => resp.json())
            .then(data => {
              if (data.error) {
                throw new Error(data.error)
              }
              console.log(`got ${data} from insert-game`)
              console.log(data)

              inserted += 1;
              if (inserted % 10 == 0) {
                $("#collection-game-count").append(` ${inserted}...`)
              }
            })
            .catch(err => {
              console.log(err)
              if (err.message == "game_already_exists") {
                alreadyThere++;
              } else {
                console.log(err.message)
                $("#collect-inspector-progress").append(`<p><b>ERROR:</b> ${err}</p>`)
              }
              inserted += 1;
              if (inserted % 10 == 0) {
                $("#collection-game-count").append(` ${inserted}...`)
              }
            }))
        promiseSerial(insertFuncs).then(res => {
          let finished = `<p>Finished importing <b>${inserted}</b> games!`
          if (alreadyThere) {
            finished += ` (<i>${alreadyThere} games already existed</i>)`
          }
          finished += "</p>"
          $("#collect-inspector-progress").append(finished)
          $("#collect-inspector-progress").append("<hr>")
          let coldStorageBuckets = {}
          for (let game of coldStorageDocs) {
            coldStorageBuckets[game.inColdStorage] = game._id
          }
          $("#collect-inspector-progress").append(`<p>Collecting <b>${coldStorageDocs.length}</b> games from cold storage (from ${Object.keys(coldStorageBuckets).length} cold-storage blocks)...`)
          let coldStorageFetchPromises = []
          for (let bucket in coldStorageBuckets) {
            let gameID = coldStorageBuckets[bucket]
            let getFromColdStorageURL = `${API_URL}/tracker-api/game/_id/${gameID}/from_cold_storage`
            coldStorageFetchPromises.push(new Promise((resolve, reject) => {
              request.get({
                url: getFromColdStorageURL,
                json: true,
                headers: {'User-Agent': 'MTGATracker-App', token: token}
              }, (err, res, data) => {
                resolve(data)
              })
            }))
          }
          Promise.all(coldStorageFetchPromises).then(results => {
            $("#collect-inspector-progress").append(`<p><i><span id="collection-game-count-cs">Processed 0...</span></i></p>`)
            let csInsertFuncs = []
            inserted = 0;
            alreadyThere = 0;
            for (let csResult of results) {
              for (let game of csResult.records) {
                game.date = new Date(Date.parse(game.date))
                csInsertFuncs.push(() => fetch(fetchURL, {method: "POST", body: JSON.stringify(game)})
                  .then(resp => resp.json())
                  .then(data => {
                    if (data.error) {
                      throw new Error(data.error)
                    }
                    console.log(`got ${data} from insert-game`)
                    console.log(data)

                    inserted += 1;
                    if (inserted % 10 == 0) {
                      $("#collection-game-count-cs").append(` ${inserted}...`)
                    }
                  })
                  .catch(err => {
                    console.log(err)
                    if (err.message == "game_already_exists") {
                      alreadyThere++;
                    } else {
                      console.log(err.message)
                      $("#collect-inspector-progress").append(`<p><b>ERROR:</b> ${err}</p>`)
                    }
                    inserted += 1;
                    if (inserted % 10 == 0) {
                      $("#collection-game-count-cs").append(` ${inserted}...`)
                    }
                  }))
              }
            }

            promiseSerial(csInsertFuncs).then(res => {
              console.log(res)
              let finished = `<p>Finished importing <b>${inserted}</b> games from cold storage!`
              if (alreadyThere) {
                finished += ` (<i>${alreadyThere} games already existed</i>)`
              }
              finished += "</p>"
              $("#collect-inspector-progress").append(finished)
              $("#collect-inspector-progress").append("<hr>")
              $("#collect-inspector-progress").append("<p>Collecting all Draft records...</p>")

              let getDraftURL = `${API_URL}/tracker-api/drafts?per_page=1000`  // Does anyone have more than a thousand drafts? no way. nope. not possible.

              request.get({
                url: getDraftURL,
                json: true,
                headers: {'User-Agent': 'MTGATracker-App', token: token}
              }, (err, res, data) => {

                $("#collect-inspector-progress").append(`<p>Adding ${data.docs.length} draft records to local Inspector...</span></p>`)
                $("#collect-inspector-progress").append(`<p><i><span id="collection-game-count-draft">Processed 0...</span></i></p>`)
                let insertDraftURL = `insp://insert-draft`
                inserted = 0
                alreadyThere = 0
                for (let draft of data.docs) draft.date = new Date(Date.parse(draft.date))
                promiseSerial(data.docs.map(draft => () => fetch(insertDraftURL, {method: "POST", body: JSON.stringify(draft)})
                  .then(resp => resp.json())
                  .then(data => {
                    if (data.error) {
                      throw new Error(data.error)
                    }
                    console.log(`got ${data} from insert-draft`)
                    console.log(data)

                    inserted += 1;
                    if (inserted % 10 == 0) {
                      $("#collection-game-count-draft").append(` ${inserted}...`)
                    }
                  })
                  .catch(err => {
                    console.log(err)
                    if (err.message == "draft_already_exists") {
                      alreadyThere++;
                    } else {
                      console.log(err.message)
                      $("#collect-inspector-progress").append(`<p><b>ERROR:</b> ${err}</p>`)
                    }
                    inserted += 1;
                    if (inserted % 10 == 0) {
                      $("#collection-game-count-draft").append(` ${inserted}...`)
                    }
                  }))).then(res => {
                    let finished = `<p>Finished importing <b>${inserted}</b> drafts!`
                    if (alreadyThere) {
                      finished += ` (<i>${alreadyThere} drafts already existed</i>)`
                    }
                    finished += "</p>"
                    $("#collect-inspector-progress").append(finished)
                    $("#collect-inspector-progress").append("<hr>")
                    $("#collect-inspector-progress").append("<p><b>All Clear!</b> Successfully completed all imports! You may now close this window.</p>")
                  })
              })
            })
          })
        })
      })
    })
  })
  $("#exportCollectionMTGGButton").click((e) => {
    console.log("exporting mtgg to desktop")
    let allPromises = []
    for (let cardKey in settingsData.lastCollection) {
      allPromises.push(mtga.allCards.findCard(cardKey))
    }

    Promise.all(allPromises).then(allCards => {
      let mtggExportPath = path.join(desktopPath, 'mtga_collection_mtggoldfish.csv')
      let csvContents = "Name,Edition,Qty,Foil\n"
      for (let card of allCards) {
        if (card) {
          let mtgaID = card.get("mtgaID")
          let prettyName = card.get("prettyName")
          let set = card.get("set")
          if (set == "DAR") set = "DOM"  // sigh, c'mon arena devs
          let count = settingsData.lastCollection[mtgaID]
          csvContents +=`"${prettyName}",${set},${count},No\n`
        }
      }
      fs.writeFile(mtggExportPath, csvContents, (err) => {
        if (err) {
          alert(`error saving export: ${err}`)
        } else {
          alert(`Saved to ${mtggExportPath} !`)
        }
      })
    })
  })

  document.getElementById("hide-delay").value = "" + settingsData.hideDelay;
  let initialValue = settingsData.hideDelay
  if (initialValue == 100) initialValue = "∞"
  $(".slidevalue").html(initialValue)
  document.getElementById("hide-delay").onchange = function() {
    let value = parseInt(this.value)
    ipcRenderer.send('settingsChanged', {key: "hideDelay", value: value})
  }
  document.getElementById("hide-delay").oninput = function() {
    let value = this.value
    if(value == 100) {
      value = "∞"
    }
    $(".slidevalue").html(value)
  }

  document.getElementById("min-vault-progress").value = "" + settingsData.minVaultProgress;
  let initialValueVault = settingsData.minVaultProgress;

  $(".slidevalue-vault").html(initialValueVault)
  document.getElementById("min-vault-progress").onchange = function() {
    let value = parseInt(this.value)
    ipcRenderer.send('settingsChanged', {key: "minVaultProgress", value: value})
  }
  document.getElementById("min-vault-progress").oninput = function() {
    let value = this.value
    $(".slidevalue-vault").html(value)
  }

  document.getElementById("recent-cards-quantity-slider").value = "" + settingsData.recentCardsQuantityToShow;
  let initialValueRecentCardsQuantityToShow = settingsData.recentCardsQuantityToShow;
  if(initialValueRecentCardsQuantityToShow == 100) {
    initialValueRecentCardsQuantityToShow = "∞"
  }
  $(".slidevalue-recent-cards").html(initialValueRecentCardsQuantityToShow)
  document.getElementById("recent-cards-quantity-slider").onchange = function() {
    let value = parseInt(this.value)
    settingsData.recentCardsQuantityToShow = value;
    ipcRenderer.send('settingsChanged', {key: "recentCardsQuantityToShow", value: value})
  }
  document.getElementById("recent-cards-quantity-slider").oninput = function() {
    let value = this.value
    settingsData.recentCardsQuantityToShow = value;
    if(value == 100) {
      value = "∞"
    }
    $(".slidevalue-recent-cards").html(value);
  }
})

// https://hackernoon.com/functional-javascript-resolving-promises-sequentially-7aac18c4431e
const promiseSerial = funcs =>
  funcs.reduce((promise, func) =>
    promise.then(result => func().then(Array.prototype.concat.bind(result))),
    Promise.resolve([]))

var token;

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

// ipcRenderer.send('settingsChanged', {cool: true})
