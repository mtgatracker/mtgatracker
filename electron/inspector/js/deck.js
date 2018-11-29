const { getGames, getDecks, getDeckWinLossByColor } = require('./api')
const { pagePrefix } = require("./conf")

let deckRoute = (c, n) => {
  appData.currentDeckName = "loading ..."
  console.log("CALLED FROM /deck/")
  if (appData.bound)
    bound.unbind()
  $("#more-games-button").unbind("click")
  $("#edit-decks").unbind("change")
  $(function() {
    $("#page-wrapper").load(`${pagePrefix}/templates/deck-inner.html?v=1.3.0`, loaded => {
      rivets.bind($('#app'), {data: appData})
      $("#more-games-button").click(() => {getGames(appData.homeGameListPage, {deckID: appData.deckID})})
      $("#matchup-style").change((e) => {
        let text = (e.target.checked ? "Multiple colors" : "Single color");
        $("#matchup-style-label").html(text)
      })

      $("#edit-decks").change((e) => {
        if (e.target.checked) {
          $(".hide-deck").slideDown()
        } else {
          $(".hide-deck").slideUp()
          $(".deckhidden").slideUp()
        }
      })

      var ctx = document.getElementById('matchup-plot').getContext('2d');
      appData.winLossColorChart = new Chart(ctx, {
        type: 'bar',
            data: {   // "#c4d3ca", "#b3ceea", "#e47777", "#f8e7b9", "#a69f9d"
              labels: ["Green", "Blue", "Red", "White", "Black"],
              datasets: [
                {
                  label: "Winrate",
                  backgroundColor: ["#c4d3ca", "#b3ceea", "#e47777", "#f8e7b9", "#a69f9d"],
                  data: [0,0,0,0,0]
                }
              ]
            },
            options: {
              legend: { display: false },
              title: {
                display: true,
                text: 'Winrate vs. Decks Containing Color'
              },
              scales: {
                yAxes: [{
                  display: true,
                  ticks: {
                    min: 0.0,
                    beingAtZero: true,
                    max: 1.0
                  }
                }]
              }
            },
        })
        appData.homeGameListPage = 1
        appData.deckID = c.params.deckID
        getGames(1, {deckID: c.params.deckID, removeOld: true, setCurrentDeckName: true})
        getDecks()
        getDeckWinLossByColor(c.params.deckID).then(values => {
          while(appData.winLossColorChart.data.datasets[0].data.length) appData.winLossColorChart.data.datasets[0].data.pop()
          for (let datum of values) appData.winLossColorChart.data.datasets[0].data.push(datum)
          appData.winLossColorChart.update()
        })
      })
  })
}

module.exports = {deckRoute:deckRoute}
