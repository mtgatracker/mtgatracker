const { getDrafts } = require('./api')
const { pagePrefix } = require('./conf')

let draftsRoute = (c, n) => {
  appData.currentDraftName = "loading ..."
  console.log("CALLED FROM /drafts/")
  if (appData.bound)
    bound.unbind()
  appData.homeDraftList = []
  $("#more-games-button").unbind("click")
  console.log("unbind change")
  $("#edit-decks").unbind("change")
  $(function() {
    $("#page-wrapper").load(`${pagePrefix}/templates/drafts-inner.html?v=1.3.0`, loaded => {
      rivets.bind($('#app'), {data: appData})
      appData.homeDraftsListPage = 1
      getDrafts(-1)
    })
  })
}

module.exports = {draftsRoute:draftsRoute}
