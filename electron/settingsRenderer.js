const { remote, ipcRenderer, shell } = require('electron')
const fs = require('fs')

const API_URL = remote.getGlobal("API_URL")
const keytar = require('keytar')
const mtga = require('mtga')
const path = require('path')
const os = require('os')

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

var settingsData = {
  version: remote.getGlobal("version"),
  settingsPaneIndex: "about",
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
  showWinLossCounter: remote.getGlobal('showWinLossCounter'),
  lastCollection: remote.getGlobal('lastCollection'),
  lastVaultProgress: remote.getGlobal('lastVaultProgress'),
  showVaultProgress: remote.getGlobal('showVaultProgress'),
  minVaultProgress: remote.getGlobal('minVaultProgress'),
  showGameTimer: remote.getGlobal('showGameTimer'),
  showChessTimers: remote.getGlobal('showChessTimers'),
  hideDelay: remote.getGlobal('hideDelay'),
  invertHideMode: remote.getGlobal('invertHideMode'),
  runFromSource: remote.getGlobal('runFromSource'),
  sortMethodSelected: remote.getGlobal('sortMethod'),
  useFlat: remote.getGlobal('useFlat'),
  useMinimal: remote.getGlobal('useMinimal'),
  updateDownloading: remote.getGlobal('updateDownloading'),
  updateReady: remote.getGlobal('updateReady'),
  firstRun: remote.getGlobal('firstRun'),
  customStyleFiles: [],
  sortingMethods: [
    {id: "draw", text: "By likelihood of next draw (default)",
    help: "This method shows cards in order from most likely to draw on top of the list to least likely to draw on the bottom, with no other considerations."},
    {id: "emerald", text: '"Emerald" method',
    help: "This method sorts cards by card type, then by cost, then by name."}
  ],
  accounts: remote.getGlobal("userMap")
}

const { Menu, MenuItem } = remote
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

rivets.formatters.countcollection = function(collection) {
    let total = 0;
    let unique = 0;
    for (let key in collection) {
      if (collection[key] && Number.isInteger(collection[key])) {
        total += collection[key]
        unique += 1
      }
    }
    return `${unique} unique cards, ${total} total cards`
};

rivets.formatters.and = function(comparee, comparator) {
    return comparee && comparator;
};

rivets.formatters.andnot = function(comparee, comparator) {
    return comparee && !comparator;
};

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

// plundered and modified from inspector
var authAttempt = function(e) {
  let accountContainer = $(e.target).parent().parent()
  let accessCode = accountContainer.find(".accessCode").val()
  let username = e.target.value

  accountContainer.find(".authorize-submit-button").html("Attempting to log in...").prop("disabled", true)

  $.ajax({
    url: `${API_URL}/public-api/auth-attempt/long-exp/`,
    type: "POST",
    data: JSON.stringify({"username": username, "accessCode": accessCode}),
    dataType: "json",
    contentType: "application/json",
    success: function(data) {
      keytar.setPassword("mtgatracker-long-token", username, data.token)
      settingsData.accounts.filter(x => x.username == username)[0].auth = true
      accountContainer.find(".authorize-button").html("Success!")
      accountContainer.find(".access-container").slideUp()
      accountContainer.find(".icon").attr('data-tooltip', 'Account is authorized!').css("color", "green");
    },
    error: function(xhr, status, err) {
      accountContainer.find(".authorize-submit-button").html("Submit code").prop("disabled", false)
      accountContainer.find('.accessCode').pincodeInput().data('plugin_pincodeInput').clear()
      console.log("error! " + status)
      console.log(xhr)
      console.log(status)
      console.log(err)
      if (xhr.responseJSON.error.includes("auth_error")) {
        alert("Incorrect code, try again")
      } else {
        alert("An unknown error occurred, please try again")
      }
    }
  })
}

var authRequest = function(e) {
  let username = e.target.value;
  $(e.target).prop("disabled", true)
  e.target.innerHTML = "Requesting code..."
  $.ajax({
    url: `${API_URL}/public-api/auth-request/long-exp/`,
    type: "POST",
    data: JSON.stringify({"username": username}),
    dataType: "json",
    contentType: "application/json",
    success: function(data) {
      e.target.innerHTML = "Enter code"
      let accountContainer = $(e.target).parent().parent()
      accountContainer.find(".access-container").slideDown()
      // to clear: $('#access-code').pincodeInput().data('plugin_pincodeInput').clear()
      // to disable: $('#access-code').pincodeInput().data('plugin_pincodeInput').disable()
      // to enable: $('#access-code').pincodeInput().data('plugin_pincodeInput').enable()
      accountContainer.find(".accessCode").pincodeInput({
        hideDigits: false,
        keydown : function(k_ev) {console.log(k_ev)},
        inputs:6,
        // callback when all inputs are filled in (keyup event)
        complete:function(value, complete_event, errorElement) {
          authAttempt(e)
        }
      });
    },
    error: function(xhr, status, err) {
      $("#token-loading").css("opacity", "0")
      console.log("error! " + status)
      console.log(xhr)
      console.log(status)
      console.log(err)
      $(e.target).prop("disabled", false)
      if (xhr.responseJSON.error.includes("no user found")) {
        $(e.target).prop("disabled", false).html("Authorize (discord)")
        alert("User not found.\n\nNote that you must have used MTGATracker to track at least one game in order to log in!")
      } else if (xhr.responseJSON.error.includes("discord mapping not found")) {
        alert("It looks like this is your first time logging in to inspector!\n\nWhen you dismiss this dialog, you will be taken to the first-time login instructions.")
        shell.openExternal("https://github.com/shawkinsl/mtga-tracker/blob/master/logging_in.md");
        $(e.target).prop("disabled", false).html("Authorize (discord)")
      } else {
        $(e.target).prop("disabled", false).html("Authorize (discord)")
        alert("An unknown error occurred, please try again")
      }
    }
  })
}


document.addEventListener("DOMContentLoaded", function(event) {
  rivets.bind(document.getElementById('container'), settingsData)

  let themePath = settingsData.runFromSource ? "themes" : "../themes";
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
  $(".authorize-button").click(authRequest)

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
  $("#resetWinLoss").click((e) => {
    console.log("resetting win/loss")
    ipcRenderer.send('settingsChanged', {key: "winLossCounter", value: {win: 0, loss: 0}})
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
})

ipcRenderer.on('userMap', (event, arg) => {
  console.log("userMap!")
  console.log(arg)
})

// ipcRenderer.send('settingsChanged', {cool: true})