const { getClientVersions } = require('./admin-api')
const { pagePrefix } = require("./conf")

/* TODO: DRY @ profile.js */
let donutOptions = {
  maintainAspectRatio: false,
  legend: {
      labels: {
          fontColor: "#474747"
      }
  },
  tooltips: {
      titleFontFamily: 'magic-font',
      callbacks: {
          // https://stackoverflow.com/questions/39500315/chart-js-different-x-axis-and-tooltip-format
          title: function(tooltipItem){
              return this._data.labels[tooltipItem[0].index];
          }
      }
  },
  tooltips: {
    callbacks: {
      label: function(tooltipItem, data) {
        //get the concerned dataset
        var dataset = data.datasets[tooltipItem.datasetIndex];
        //calculate the total of this data set
        var total = dataset.data.reduce(function(previousValue, currentValue, currentIndex, array) {
          return previousValue + currentValue;
        });
        //get the current items value
        var currentValue = dataset.data[tooltipItem.index];
        //calculate the precentage based on the total and current item, also this does a rough rounding to give a whole number
        var precentage = Math.floor(((currentValue/total) * 100)+0.5);

        return precentage + "%" + " (" + currentValue + ")";
      }
    }
  }
}

var niceColors = [
  "#FF8500",
  "#B01124",
  "#99FF00",
  "#FFED00",
  "#3db0de",
  "#AAAAAA",
  "#9A989F",  // 6
  "#d09dfd",
  "#AEE5D8",
  "#95867F",
  "#80A1C1",
  "#BFD7B5",
  "#34608F",  // 12
  "#D3DFB8",
  "#C6A15B",
  "#720E07",
  "#8B6220",
]

let adminRoute = (c, n) => {
  console.log("CALLED FROM /admin/")
  if (appData.bound)
    bound.unbind()
  $(function() {
    $("#page-wrapper").load(`${pagePrefix}/templates/admin-inner.html?v=1.3.0`, loaded => {
      rivets.bind($('#app'), {data: appData})
      /*
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
        */

        var ctx = document.getElementById('client-versions-plot').getContext('2d');
        appData.clientVersionChart = new Chart(ctx, {
          type: 'doughnut',
          data: {   // "#c4d3ca", "#b3ceea", "#e47777", "#f8e7b9", "#a69f9d"
            labels: ["Unknown"],
            datasets: [
              {
                backgroundColor: niceColors,
                data: [0],
                borderColor: "#eee",
                borderWidth: 3
              }
            ]
          },
          options: donutOptions
        })
        getClientVersions().then(clientVersions => {
          let counts = clientVersions.counts
          let formattedData = []
          let formattedLabels = []
          for (let versionKey in counts) {
            formattedLabels.push(versionKey)
            formattedData.push(counts[versionKey])
          }
          appData.clientVersionChart.data.datasets[0].data = formattedData
          appData.clientVersionChart.data.labels = formattedLabels
          appData.clientVersionChart.update()
        })
      })
  })
}

module.exports = {adminRoute: adminRoute}