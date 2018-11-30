const { getDraft, getDrafts } = require('./api')
const { pagePrefix } = require("./conf")

let draftRoute = (c, n) => {
  appData.currentDeckName = "loading ..."
  console.log("CALLED FROM /draft/")
  if (appData.bound)
    bound.unbind()
  $("#more-games-button").unbind("click")
  $("#edit-decks").unbind("change")
  $(function() {
    $("#page-wrapper").load(`${pagePrefix}/templates/draft-inner.html?v=1.3.0`, loaded => {
      rivets.bind($('#app'), {data: appData})
      getDrafts(10)
      getDraft(c.params.draftID).then(draft => {
          appData.picks = []
          appData.eventName = draft.draftID.split(":")[1]

          Object.values(draft.picks).forEach(event => {

            let pick = {}
            pick.pickNumber = event.pickNumber+1
            pick.packNumber = event.packNumber+1
            let card = cardUtils.allCards.findCard(event.pick)
            if (card) {
              let cardObj = {
                cardID: event.pick,
                colors: card.get("colors"),
                cost: card.get("cost"),
                name: card.get("prettyName"),
                set: card.get("set"),
                rarity: card.get("rarity"),
                setNumber: card.get("setNumber"),
                cardType: card.get("cardType").split(" ").slice(-1)[0] // "Legendary Creature" => "Creature"
              }
              pick.pick = cardObj
            }
            let pack = []
            Object.values(event.pack).forEach(passed => {
              let card = cardUtils.allCards.findCard(passed)
              if (card && passed != event.pick) {
                let cardObj = {
                  cardID: passed,
                  colors: card.get("colors"),
                  cost: card.get("cost"),
                  name: card.get("prettyName"),
                  set: card.get("set"),
                  rarity: card.get("rarity"),
                  setNumber: card.get("setNumber"),
                  cardType: card.get("cardType").split(" ").slice(-1)[0] // "Legendary Creature" => "Creature"
                }
                pack.push(cardObj)
              }
              })
            pick.pack = pack
            appData.picks.push(pick)


            })
          })
      })
  })
}

module.exports = {draftRoute:draftRoute}
