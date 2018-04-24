const { remote, ipcRenderer } = require('electron')

const HIDE_MODE_ROLL = 0;
const HIDE_MODE_FADE = 1;

var settingsData = {
  hideMode: HIDE_MODE_FADE,
  showInterfaceSettings: true,
  showPrivacySettings: false,
  debug: remote.getGlobal('debug'),
  useFrame: remote.getGlobal('useFrame')
}

rivets.bind(document.getElementById('container'), settingsData)

let resetView = () => {
  settingsData.showPrivacySettings = false;
  settingsData.showInterfaceSettings = false;
}

document.addEventListener("DOMContentLoaded", function(event) {
  $("#interface-nav").click((e) => {
    resetView()
    settingsData.showInterfaceSettings = true;
  })
  $("#privacy-nav").click((e) => {
    resetView()
    settingsData.showPrivacySettings = true;
  })
  $('.tf-toggle').change(function() {
    ipcRenderer.send('settingsChanged', {key: $(this).attr("key"), value: $(this).prop('checked')})
  })
})

// ipcRenderer.send('settingsChanged', {cool: true})