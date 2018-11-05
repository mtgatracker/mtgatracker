function getDeckById(deckID){
  var deck;
  $.each(appData.player_decks, (i, v) => {
      if (v.deck_id == deckID) {
         deck = v;
         return false;
      }
  })
  return deck;
}
