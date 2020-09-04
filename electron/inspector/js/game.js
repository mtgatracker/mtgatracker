// /game/_id/:_id
// 5af804c72088d900069b283a

const { getGame, getDecks } = require('./api')
const { pagePrefix } = require('./conf')
const allTypes = [
  'Creature',
  'Sorcery',
  'Instant',
  'Enchantment',
  'Planeswalker',
  'Artifact',
  'Land'
]

let gameRoute = (c, n) => {
  console.log("CALLED FROM /game/")
  appData.currentGameWinner = "loading ..."
  appData.currentGameName = ""
  appData.currentGameHero = ""
  appData.currentGameHeroDeck = []
  appData.currentGameHeroDeckName = "loading ..."
  appData.currentGameOpponent = ""
  appData.currentGameOpponentDeck = []
  appData.currentGameOpponentDeckName = "loading ..."
  if (appData.bound)
    bound.unbind()

  $("#edit-decks").unbind("change")

  $(function() {
    $("#page-wrapper").load(`${pagePrefix}/templates/game-inner.html?v=1.3.0`, loaded => {
      rivets.bind($('#app'), {data: appData})
      getDecks()
      appData.currentGameHasRankInfo = false;
      appData.currentGameHasInfo = false;
      getGame(c.params.gameID).then(game => {
        if(game.eventID) {  // old records don't have this stuff, let it be
          appData.currentGameEvent = `${game.eventID}`
          appData.currentGameOnPlay = `${game.onThePlay}`
          appData.currentGameElapsedTime = `${game.elapsedTime}`
          appData.currentGameTurnCount = game.turnNumber
          appData.currentGameOpponentRank = game.opponentStartingRank
          appData.currentGameHasInfo = true;
        }

        if (game.rankChange) {
          appData.currentGameHeroRankBefore = `${game.rankChange.oldClass} ${game.rankChange.oldLevel} - Step ${game.rankChange.oldStep}`
          appData.currentGameHeroRankAfter = `${game.rankChange.newClass} ${game.rankChange.newLevel} - Step ${game.rankChange.newStep}`
          tierChange = game.rankChange.newLevel - game.rankChange.oldLevel;
          stepChange = game.rankChange.newStep - game.rankChange.oldStep;

          if (tierChange === 0) {
            appData.currentGameHeroRankChange = `${stepChange === 0 ? '' : stepChange > 0 ? 'Up' : 'Down' } ${Math.abs(stepChange)} Step${Math.abs(stepChange) === 1 ? '': 's'}`
          } else {
            // Tiers go in reverse order, so 2 -> 1 is up
            appData.currentGameHeroRankChange = `${tierChange < 0 ? 'Up' : 'Down' } ${Math.abs(tierChange)} Tier${Math.abs(tierChange) === 1 ? '': 's'}`
          }

          if (game.rankChange.newClass !== game.rankChange.oldClass) {
            appData.currentGameHeroRankChange = `Rank Up!`
          }
          appData.currentGameHasRankInfo = true;
        }

        let turn = 0;
        let players = game.onThePlay == game.hero ? [game.hero, game.opponent] : [game.opponent, game.hero];

        appData.currentGameActionLog = []

        if (game.gameHistory && game.historyKey) {
          for (let event of game.gameHistory) {
            let eventTexts = []
            for (let key of event) {
              let thisText = game.historyKey[key];
              if (thisText == "turn++") {
                let playerTurn = turn / 2 + 1;
                thisText = {text: `${turn+1} / ${players[turn++ % 2]} turn ${Math.floor(playerTurn)}`, type: "turn"}
              }
              eventTexts.push(thisText)
            }
            appData.currentGameActionLog.push(eventTexts)
          }
        } else {
          appData.currentGameActionLog.push(["No history to show :("])
        }

        appData.currentGameName = `${game.hero} vs ${game.opponent}`
        appData.currentGameID = game._id
        appData.currentGameIsPermanent = game.permanent || false;
        appData.currentGameInColdStorage = game.inColdStorage || false;
        appData.currentGameHero = game.hero
        appData.currentGameWinner = game.winner
        appData.currentGameOpponent = game.opponent
        appData.currentGameHeroDeck = []
        appData.currentGameHeroSideboard = []

        Object.keys(game.players[0].deck.cards).forEach(cardID => {
          let card = cardUtils.allCards.findCard(cardID)
          if (card) {
            let cardObj = {
              cardID: cardID,
              count: game.players[0].deck.cards[cardID],
              colors: card.get("colors"),
              cost: card.get("cost"),
              name: card.get("prettyName"),
              set: card.get("set"),
              setNumber: card.get("setNumber"),
              cardType: card.get("cardType").split(" ").slice(-1)[0] // "Legendary Creature" => "Creature"
            }
            appData.currentGameHeroDeck.push(cardObj)
          }
        })
        if (game.players[0].deck.sideboard)
        {
            Object.keys(game.players[0].deck.sideboard).forEach(cardID => {
              let card = cardUtils.allCards.findCard(cardID)
              if (card) {
                let cardObj = {
                  cardID: cardID,
                  count: game.players[0].deck.sideboard[cardID],
                  colors: card.get("colors"),
                  cost: card.get("cost"),
                  name: card.get("prettyName"),
                  set: card.get("set"),
                  setNumber: card.get("setNumber"),
                  cardType: card.get("cardType").split(" ").slice(-1)[0] // "Legendary Creature" => "Creature"
                }
                appData.currentGameHeroSideboard.push(cardObj)
              }
            })
        }

        appData.currentGameHeroDeckName = `${game.hero}'s deck: ${game.players[0].deck.poolName}`
        appData.currentGameOpponentDeckName = game.players[1].deck.poolName
        appData.currentGameOpponentDeck = []
        Object.keys(game.players[1].deck.cards).forEach(cardID => {
          let card = cardUtils.allCards.findCard(cardID)
          if (card) {
            let cardObj = {
              cardID: cardID,
              count: game.players[1].deck.cards[cardID],
              colors: card.get("colors"),
              cost: card.get("cost"),
              name: card.get("prettyName"),
              set: card.get("set"),
              setNumber: card.get("setNumber"),
              cardType: card.get("cardType").split(" ").slice(-1)[0] // "Legendary Creature" => "Creature"
            }
            appData.currentGameOpponentDeck.push(cardObj)
          }
        })

        if (localStorage.getItem("dark-mode") == "true") enableDarkMode(true)
      })

      $("#edit-decks").change((e) => {
        console.log("edit decks")
        if (e.target.checked) {
          $(".hide-deck").slideDown()
        } else {
          $(".hide-deck").slideUp()
          $(".deckhidden").slideUp()
        }
      })
    })
  })
}

module.exports = {gameRoute:gameRoute}
