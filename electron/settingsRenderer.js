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
  mouseEvents: remote.getGlobal('mouseEvents'),
  leftMouseEvents: remote.getGlobal('leftMouseEvents'),
  showWinLossCounter: remote.getGlobal('showWinLossCounter'),
  runFromSource: remote.getGlobal('runFromSource'),
  customStyleFiles: [],
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
  $(document).on('click', 'a[href^="http"]', function(event) {
      event.preventDefault();
      shell.openExternal(this.href);
  });
  rivets.bind(document.getElementById('container'), settingsData)
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
  $("#custom-theme-select").change(function() {
    console.log("apply theme was just toggled")
    let themeSelected = $("#custom-theme-select").val()
    ipcRenderer.send('settingsChanged', {key: "useTheme", value: settingsData.useTheme})
    ipcRenderer.send('settingsChanged', {key: "themeFile", value: themeSelected})
  })
  $("#resetWinLoss").click((e) => {
    console.log("resetting win/loss")
    ipcRenderer.send('settingsChanged', {key: "winLossCounter", value: {win: 0, loss: 0}})
  })
  let themePath = settingsData.runFromSource ? "themes" : "../themes";
  fs.readdir(themePath, (err, files) => {
    if(files) {
      files.forEach((val) => {
        if (val.endsWith(".css")) {
          settingsData.customStyleFiles.push(val)
        }
      })
    }
  })
})

// ipcRenderer.send('settingsChanged', {cool: true})