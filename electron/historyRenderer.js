const { remote, ipcRenderer, shell } = require('electron')
const fs = require('fs')

const mtga = require('mtga')

let historyWindow = remote.getCurrentWindow()

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
  historyEvents: [],
  zoom: remote.getGlobal("historyZoom")
}

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
    $("#events-container").animate({ scrollTop: $('#events-container').prop("scrollHeight")}, 100);
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
})

ipcRenderer.on('gameHistoryEventSend', (event, arg) => {
  console.log(arg)
  historyData.historyEvents.push(arg)
})