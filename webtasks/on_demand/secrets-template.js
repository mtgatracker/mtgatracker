module.exports = {
  verifyGame: (game, gameHash, hashPass) => {
    // this is a fake function

    if (game.gameID === undefined) {
      return false
    }

    return gameHash.indexOf("987654321") != -1
  }
}