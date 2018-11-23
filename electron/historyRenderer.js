const { remote, ipcRenderer, shell } = require('electron')
const fs = require('fs')
const mtga = require('mtga')
const hideWindowManager = require('./hide-manager')
const activeWin = require("active-win")

let historyWindow = remote.getCurrentWindow()
let scrolling = false;

const tt = require('electron-tooltip')
tt({
  position: 'top',
  style: {
    backgroundColor: 'dark gray',
    color: 'white',
    borderRadius: '4px',
  }
})

var historyData = {
  mtgaOverlayOnly: remote.getGlobal("mtgaOverlayOnly"),
  debug: remote.getGlobal('debug'),
  invertHideMode: remote.getGlobal('invertHideMode'),
  rollupMode: remote.getGlobal('rollupMode'),
  historyEvents: remote.getGlobal("historyEvents", []),
  zoom: remote.getGlobal("historyZoom"),
}

var hideModeManager;

// poll for active window semi-regularly; if it's not MTGA or MTGATracker, minimize / unset alwaysontop
setInterval(() => {
  if (remote.getGlobal("mtgaOverlayOnly")) {
    activeWin().then(win => {
      if (win.owner.name == "MTGA.exe" || win.owner.name == "MTGATracker.exe" || win.title == "MTGA Tracker") {
        if(!historyWindow.isAlwaysOnTop()) historyWindow.setAlwaysOnTop(true)
      } else {
        if(historyWindow.isAlwaysOnTop()) historyWindow.setAlwaysOnTop(false)
      }
    })
  } else {
    console.log("skipping overlay check and turning on always on top")
    if(!browserWindow.isAlwaysOnTop()) browserWindow.setAlwaysOnTop(true)
  }
}, 200)

const { Menu, MenuItem, dialog } = remote
const menu = new Menu()
const menuItem = new MenuItem({
  label: 'Inspect Element',
  click: () => {
    remote.getCurrentWindow().inspectElement(rightClickPosition.x, rightClickPosition.y)
  }
})
menu.append(menuItem)

if (historyData.debug) {
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    rightClickPosition = {x: e.x, y: e.y}
    menu.popup(remote.getCurrentWindow())
  }, false)
}

rivets.binders.expandevent = function(el, value) {
  for (let eventText of value) {
    if (typeof eventText == "string") {
      eventText = {"text": eventText, "type": "text"}
    }
    let span = document.createElement('span')
    span.innerHTML = eventText.text;
    span.classList.add(eventText.type)
    if (eventText.hover) {
     span.setAttribute("data-toggle", "tooltip")
     span.setAttribute("title", eventText.hover)
    }
    el.appendChild(span)
    if (eventText.type == "game") {
      let hr = document.createElement("hr")
      el.appendChild(hr)
    }
    if (!scrolling) {
      let container = $("#events-container")
      let shouldScroll = container.prop("scrollHeight") - (container.height() + container.scrollTop()) < 30;
      if (shouldScroll) {
        scrolling = true;
        container.animate({ scrollTop: $('#events-container').prop("scrollHeight")}, 100, function() {
          scrolling = false;
        });
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", function(event) {
  rivets.bind(document.getElementById('container'), historyData)

  $(".zoom-out").click(() => {
      historyData.zoom -= 0.1
      historyData.zoom = Math.max(historyData.zoom, 0.2)
      historyWindow.webContents.setZoomFactor(historyData.zoom)
      ipcRenderer.send('settingsChanged', {key: "history-zoom", value: historyData.zoom})
  })
  $(".zoom-in").click(() => {
      historyData.zoom += 0.1
      historyWindow.webContents.setZoomFactor(historyData.zoom)
      ipcRenderer.send('settingsChanged', {key: "history-zoom", value: historyData.zoom})
  })
  $("#floating-eraser").click(event => {
      console.log("clicky")
      historyData.historyEvents = []
      ipcRenderer.send('clearGameHistory')
  })
  $('#close-icon').click((e) => {historyWindow.close()})

  hideModeManager = hideWindowManager({
    useRollupMode: function() {return remote.getGlobal('rollupMode')},
    getHideDelay: function() {return remote.getGlobal('hideDelay')},
    getInverted: function() {return remote.getGlobal('invertHideMode')},
    windowName: "historyRenderer",
    bodyID: "#events-container",
    headerID: ".history-header",
    containerID: "#container",
    hideCallback: function() {},
    bodyHeightTarget: "90%",
    containerHeightTarget: "100%",
  })

})

ipcRenderer.on('gameHistoryEventSend', (event, arg) => {
  historyData.historyEvents.push(arg)
})

ipcRenderer.on("clearGameHistory", (event, arg) => {
  historyData.historyEvents = []
})

ipcRenderer.on('hideRequest', (event, arg) => {
  hideModeManager.toggleHidden(arg)
})
