gamesOverTime = document.getElementById('games-over-time');

$.getJSON("data/anonymized_set_nodecks.json", function(json) {
    allGames = json.games;
    allGames.sort(function(a, b){
        var keyA = new Date(a.date),
            keyB = new Date(b.date);
        // Compare the 2 dates
        if(keyA < keyB) return -1;
        if(keyA > keyB) return 1;
        return 0;
    });
    plotGamesOverTime(allGames)
});

plotGamesOverTime = (sortedGames) => {
    gameCount = 0;
    gameCounts = [];
    gameDates = [];
    $.each(sortedGames, function(idx, game) {
        gameDates.push(new Date(game.date))
        gameCounts.push(gameCount++)
    })

    var d3 = Plotly.d3;

    var WIDTH_IN_PERCENT_OF_PARENT = 100
//        HEIGHT_IN_PERCENT_OF_PARENT = 10;

    var gd3 = d3.select('#games-over-time')
        .style({
            width: WIDTH_IN_PERCENT_OF_PARENT + '%',
            'margin-left': (100 - WIDTH_IN_PERCENT_OF_PARENT) / 2 + '%',

            height: "600px;"
//            'margin-top': (100 - HEIGHT_IN_PERCENT_OF_PARENT) / 2 + 'vh'
        });

    var gamesOverTime = gd3.node();

    Plotly.plot(gamesOverTime, [{
            x: gameDates,
            y: gameCounts
        }], {
        margin: { t: 0 } } );

    window.onresize = function() {
        Plotly.Plots.resize(gamesOverTime);
    };

}

/* Current Plotly.js version */
console.log(Plotly.BUILD);
// Some info about viewport percentages:
// http://stackoverflow.com/questions/1575141/make-div-100-height-of-browser-window

