const { remote, ipcRenderer, shell } = require('electron')
const fs = require('fs')

var settingsData = {
  version: remote.getGlobal("version"),
  settingsPaneIndex: "about",
  debug: remote.getGlobal('debug'),
  showErrors: remote.getGlobal('showErrors'),
  showInspector: remote.getGlobal('showInspector'),
  incognito: remote.getGlobal('incognito'),
  useFrame: remote.getGlobal('useFrame'),
  useTheme: remote.getGlobal('useTheme'),
  themeFile: remote.getGlobal('themeFile'),
  mouseEvents: remote.getGlobal('mouseEvents'),
  leftMouseEvents: remote.getGlobal('leftMouseEvents'),
  showWinLossCounter: remote.getGlobal('showWinLossCounter'),
  showGameTimer: remote.getGlobal('showGameTimer'),
  showChessTimers: remote.getGlobal('showChessTimers'),
  hideDelay: remote.getGlobal('hideDelay'),
  invertHideMode: remote.getGlobal('invertHideMode'),
  runFromSource: remote.getGlobal('runFromSource'),
  sortMethodSelected: remote.getGlobal('sortMethod'),
  useFlat: remote.getGlobal('useFlat'),
  useMinimal: remote.getGlobal('useMinimal'),
  customStyleFiles: [],
  sortingMethods: [
    {id: "draw", text: "By likelihood of next draw (default)",
    help: "This method shows cards in order from most likely to draw on top of the list to least likely to draw on the bottom, with no other considerations."},
    {id: "emerald", text: '"Emerald" method',
    help: "This method sorts cards by card type, then by cost, then by name."}
  ]
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
  console.log(settingsData.sortMethodSelected)
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
})

// ipcRenderer.send('settingsChanged', {cool: true})