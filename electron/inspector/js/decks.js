const { getGames, getDecks } = require('./api')
const { pagePrefix } = require('./conf')

let decksRoute = (c, n) => {
  appData.currentDeckName = "loading ..."
  console.log("CALLED FROM /decks/")
  if (appData.bound)
    bound.unbind()
  appData.homeDeckList = []
  $("#more-games-button").unbind("click")
  console.log("unbind change")
  $("#edit-decks").unbind("change")
  $(function() {
    $("#page-wrapper").load(`${pagePrefix}/templates/decks-inner.html?v=1.3.0`, loaded => {
      rivets.bind($('#app'), {data: appData})
      appData.homeGameListPage = 1

      getDecks(true)

      $("#edit-decks").change((e) => {
        if (e.target.checked) {
          $(".hide-deck").slideDown()
        } else {
          $(".hide-deck").slideUp()
        }
      })
    })
  })
}

module.exports = {decksRoute:decksRoute}
