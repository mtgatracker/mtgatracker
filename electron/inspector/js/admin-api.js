// TODO: fix this somehow

const { API_URL } = require('./api')

let { loginCheck } = require('./conf')

var getClientVersions = function(gameID) {
  return new Promise((resolve, reject) => {
    $("#client-versions-loading").css("display", "block")
    let token = loginCheck()
    $.ajax({
      url: `${API_URL}/admin-api/users/client_versions`,
      headers: {token: token},
      success: function(data) {
        $("#client-versions-loading").css("display", "none")
        console.log(data)
        resolve(data)
      },
      error: function(err) {
        if (err.status == 401) {
          document.location.href = "/login"
        } else if (err.responseJSON.error && err.responseJSON.error == "your account has been locked") {
          // nothing to do
        }
        $("#client-versions-loading").css("display", "none")
        reject(err)
      }
    })
  })
}

module.exports = {
    getClientVersions: getClientVersions,
}
