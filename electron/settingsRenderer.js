const { remote, ipcRenderer, shell } = require('electron')
const {dialog, Menu, MenuItem,} = remote
const fs = require('fs')

const API_URL = remote.getGlobal("API_URL")
const keytar = require('keytar')
const mtga = require('mtga')
const path = require('path')
const request = require('request')
const os = require('os')
const jwt = require('jsonwebtoken')
const Datastore = require('nedb')

var { rendererPreload } = require('electron-routes');
rendererPreload();

var { databaseFiles } = require("./conf")

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
  sendAnonymousUsageInfo: remote.getGlobal('sendAnonymousUsageInfo'),
  showErrors: remote.getGlobal('showErrors'),
  showInspector: remote.getGlobal('showInspector'),
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
  showVaultProgress: remote.getGlobal('showVaultProgress'),
  minVaultProgress: remote.getGlobal('minVaultProgress'),
  showGameTimer: remote.getGlobal('showGameTimer'),
  showChessTimers: remote.getGlobal('showChessTimers'),
  hideDelay: remote.getGlobal('hideDelay'),
  invertHideMode: remote.getGlobal('invertHideMode'),
  rollupMode: remote.getGlobal('rollupMode'),
  minToTray: remote.getGlobal('minToTray'),
  runFromSource: remote.getGlobal('runFromSource'),
  sortMethodSelected: remote.getGlobal('sortMethod'),
  useFlat: remote.getGlobal('useFlat'),
  useMinimal: remote.getGlobal('useMinimal'),
  updateDownloading: remote.getGlobal('updateDownloading'),
  updateReady: remote.getGlobal('updateReady'),
  firstRun: remote.getGlobal('firstRun'),
  trackerID: remote.getGlobal('trackerID'),
  externalDatabaseConnectionStrings: [],
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

rivets.binders.deckid = function(el, value) {
  el.setAttribute('data-deckid', value);
}

var firstCounterAdjButtonClicked = true;

function updateConnections() {
  connections = []
  $(".connection-input").filter((e, v) => $(v).val()).each((e, v) => connections.push($(v).val()))
  settingsData.externalDatabaseConnectionStrings = connections;
}

document.addEventListener("DOMContentLoaded", function(event) {
  rivets.bind(document.getElementById('container'), settingsData)

  // TODO: here
  keytar.getPassword("mtgatracker", "external-database-connections").then(connections => {
    // rivets doesn't like raw assignment, each elem must be pushed :|
    if (connections) {
        var asStrings = JSON.parse(connections)
        asStrings.map(conn => settingsData.externalDatabaseConnectionStrings.push(conn))
    }

    // this needs to be AFTER we've loaded / added connection strings, else new connections strings won't get
    // the click event!
    $(".remove-connection").click(e => {
      updateConnections()
      settingsData.externalDatabaseConnectionStrings = settingsData.externalDatabaseConnectionStrings.filter(a => a != e.target.value)
    })
  })

  $("#add-connection").click(e => {
    // before modifying the array, make sure we have the latest copies of all values (else modifying array will erase them)
    updateConnections()
    // now add a new connection
    settingsData.externalDatabaseConnectionStrings.push("")
  })

  $("#sync-databases").click(e => {
    $("#sync-databases").html("Syncing, this may take a while...")
    $("#sync-databases").attr("disabled", "true")
    connections = []
    $(".connection-input").filter((e, v) => $(v).val()).each((e, v) => connections.push($(v).val()))
    keytar.setPassword("mtgatracker", "external-database-connections", JSON.stringify(connections)).then(set => {
      fetch(`insp://sync`)
        .then(resp => resp.json())
        .then(data => {
          console.log(data)
          alert(`Uploaded ${data.uploaded} and downloaded ${data.downloaded} records.`)
          $("#sync-databases").html("Save connections and sync databases")
          $("#sync-databases").removeAttr("disabled")
        })
    })
  })

  $("#save-connections").click(e => {
    connections = []
    $(".connection-input").filter((e, v) => $(v).val()).each((e, v) => connections.push($(v).val()))
    keytar.setPassword("mtgatracker", "external-database-connections", JSON.stringify(connections))

    alert(`Saved ${connections.length} connections`)
  })

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
    if (e.target.attributes.value != undefined){
      settingsData.settingsPaneIndex = e.target.attributes.value.value
    } else {
      settingsData.settingsPaneIndex = e.target.parentNode.attributes.value.value
    }
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
  $("#game-db-import-select").click(function() {
    dialog.showOpenDialog({
      properties: ["openFile"],
      defaultPath: databaseFiles.game
    }, filePath => {
      if (filePath) {
        $("#db-import-progress").append(`<p>Importing from: ${filePath}</p>`)
        let importDB = new Datastore({filename: filePath[0]})
        importDB.loadDatabase(err => {
          if (err) {
            $("#db-import-progress").append(`<p><b>ERROR</b>: ${err}</p>`)
            $("#db-import-progress").append("<hr>")
            return
          }
          importDB.count({}, (err, count) => {
            $("#db-import-progress").append(`<p>Attempting to import ${count} games</p>`)
            importDB.find({}, (err, docs) => {
              console.log(docs[0])
              if (!docs[0].gameID) {
                $("#db-import-progress").append("<p><b>ERROR</b>: wrong database type!</p>")
                $("#db-import-progress").append("<hr>")
                return
              }
              let inserted = 0;
              let alreadyThere = 0;
              let fetchURL = `insp://insert-game`
              $("#db-import-progress").append(`Processing... `)
              let insertFuncs = docs.map(doc => () => fetch(fetchURL, {method: "POST", body: JSON.stringify(doc)})
                .then(resp => resp.json())
                .then(data => {
                  if (data.error) {
                    throw new Error(data.error)
                  }
                  console.log(`got ${data} from insert-game`)
                  inserted += 1;
                  if (inserted % 10 == 0) {
                    $("#db-import-progress").append(` ${inserted}...`)
                  }
                })
                .catch(err => {
                 console.log(err)
                  if (err.message == "game_already_exists") {
                    alreadyThere++;
                  } else {
                    console.log(err)
                    $("#db-import-progress").append(`<p><b>ERROR:</b> ${err}</p>`)
                  }
                  inserted += 1;
                  if (inserted % 10 == 0) {
                    $("#db-import-progress").append(` ${inserted}...`)
                  }
                }))
              promiseSerial(insertFuncs).then(res => {
                let finished = `<p>Finished importing <b>${inserted}</b> games!`
                if (alreadyThere) {
                  finished += ` (<i>${alreadyThere} games already existed</i>)`
                }
                finished += "</p>"
                $("#db-import-progress").append(finished)
                $("#db-import-progress").append("<hr>")
              })
            })
          })
        })
      }
    })
  })

  $("#draft-db-import-select").click(function() {
    dialog.showOpenDialog({
      properties: ["openFile"],
      defaultPath: databaseFiles.draft
    }, filePath => {
      if (filePath) {
        $("#db-import-progress").append(`<p>Importing from: ${filePath}</p>`)
        let importDB = new Datastore({filename: filePath[0]})
        importDB.loadDatabase(err => {
          if (err) {
            $("#db-import-progress").append(`<p><b>ERROR</b>: ${err}</p>`)
            $("#db-import-progress").append("<hr>")
            return
          }
          importDB.count({}, (err, count) => {
            $("#db-import-progress").append(`<p>Attempting to import ${count} drafts</p>`)
            importDB.find({}, (err, docs) => {
              console.log(docs[0])
              if (!docs[0].draftID) {
                $("#db-import-progress").append("<p><b>ERROR</b>: wrong database type!</p>")
                $("#db-import-progress").append("<hr>")
                return
              }
              let inserted = 0;
              let alreadyThere = 0;
              let insertDraftURL = `insp://insert-draft`
              $("#db-import-progress").append(`Processing... `)
              promiseSerial(docs.map(draft => () => fetch(insertDraftURL, {method: "POST", body: JSON.stringify(draft)})
                  .then(resp => resp.json())
                  .then(data => {
                    if (data.error) {
                      throw new Error(data.error)
                    }
                    console.log(`got ${data} from insert-draft`)
                    console.log(data)

                    inserted += 1;
                    if (inserted % 10 == 0) {
                      $("#db-import-progress").append(` ${inserted}...`)
                    }
                  })
                  .catch(err => {
                    console.log(err)
                    if (err.message == "draft_already_exists") {
                      alreadyThere++;
                    } else {
                      console.log(err.message)
                      $("#db-import-progress").append(`<p><b>ERROR:</b> ${err}</p>`)
                    }
                    inserted += 1;
                    if (inserted % 10 == 0) {
                      $("#db-import-progress").append(` ${inserted}...`)
                    }
                  }))).then(res => {
                    let finished = `<p>Finished importing <b>${inserted}</b> drafts!`
                    if (alreadyThere) {
                      finished += ` (<i>${alreadyThere} drafts already existed</i>)`
                    }
                    finished += "</p>"
                    $("#db-import-progress").append(finished)
                    $("#db-import-progress").append("<hr>")
                  })
            })
          })
        })
      }
    })
  })

  $("#collect-all-inspector-data").click((e) => {
    $("#collect-inspector-progress").css("display", "block")
    $("#collect-inspector-progress").append("<p>Authenticating with Inspector API...</p>")
    $("#collect-all-inspector-data").prop("disabled", true)
    let gameUrl = API_URL + "/tracker-api/games"

    keytar.getPassword("mtgatracker", "tracker-id").then(trackerID => {
      let override = $("#key-override").val()
      getTrackerToken(override || trackerID).then(tokenObj => {
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
      }).catch(err => {
        console.log(err)
        $("#collect-inspector-progress").append(`<p><b>ERROR</b>: authentication failed!</p>`)
      })
    })
  })

  $("#send-feedback").click((e) => {
    console.log("sending feedback")
    let data = {
      feedbackType: $("#feedback-type-select").val(),
      feedbackText: $("#feedback-text").val(),
      contactInfo: $("#contact-info").val(),
    }
    if (!data.feedbackText) {
      alert("Whoops, you forgot to fill out... er, the most important part of the form!")
    } else {
      $("#send-feedback").prop("disabled", true)
      $("#send-feedback").html("Working on it...")
      passThrough("public-api/feedback", data).then(r => {
        console.log("success")
        $("#send-feedback").html("Sent! Thanks!")
      }).catch(e => {
        console.log("error sending feedback :(")
        console.log(e)
        alert("Something went wrong! Try again?")
        $("#send-feedback").prop("disabled", false)
        $("#send-feedback").html("Try again?")
      })
    }
  })

  $("#send-feedback").click((e) => {
    console.log("sending feedback")
    let data = {
      feedbackType: $("#feedback-type-select").val(),
      feedbackText: $("#feedback-text").val(),
      contactInfo: $("#contact-info").val(),
    }
    if (!data.feedbackText) {
      alert("Whoops, you forgot to fill out... er, the most important part of the form!")
    } else {
      $("#send-feedback").prop("disabled", true)
      $("#send-feedback").html("Working on it...")
      passThrough("public-api/feedback", data).then(r => {
        console.log("success")
        $("#send-feedback").html("Sent! Thanks!")
      }).catch(e => {
        console.log("error sending feedback :(")
        console.log(e)
        alert("Something went wrong! Try again?")
        $("#send-feedback").prop("disabled", false)
        $("#send-feedback").html("Try again?")
      })
    }
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

})

// TODO: DRY @ mainRenderer.js
var uploadDelay = 0;
function passThrough(endpoint, passData, errors) {
  if (!errors) {
    errors = []
  }
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(`posting ${endpoint} request...`)
      request.post({
        url: `${API_URL}/${endpoint}`,
        json: true,
        body: passData,
        headers: {'User-Agent': 'MTGATracker-App'}
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
  })
}

// https://hackernoon.com/functional-javascript-resolving-promises-sequentially-7aac18c4431e
const promiseSerial = funcs =>
  funcs.reduce((promise, func) =>
    promise.then(result => func().then(Array.prototype.concat.bind(result))),
    Promise.resolve([]))

var token;

let getTrackerToken = (trackerID) => {
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
      console.log("sending token request...")
      request.post({
          url: `${API_URL}/public-api/tracker-token`,
          json: true,
          body: {trackerID: trackerID},
          headers: {'User-Agent': 'MTGATracker-App'}
      }, (err, res, data) => {
        if (err || res.statusCode != 200) {
          reject({error: err})
        } else {
          token = data.token;
          resolve({token: data.token})
        }
      })
    }
  })
}

// ipcRenderer.send('settingsChanged', {cool: true})
var uploadDelay = 0;
function passThrough(endpoint, passData, errors) {
  if (!errors) {
    errors = []
  }
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      console.log(`posting ${endpoint} request...`)
      request.post({
        url: `${API_URL}/${endpoint}`,
        json: true,
        body: passData,
        headers: {'User-Agent': 'MTGATracker-App'}
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
  })
}
