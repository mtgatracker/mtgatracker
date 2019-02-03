
const { remote, ipcRenderer, shell } = require('electron')
const {dialog, Menu, MenuItem,} = remote
const fs = require('fs')

const API_URL = remote.getGlobal("API_URL")
const keytar = require('keytar')
const mtga = require('mtga')
const path = require('path')
const os = require('os')
const jwt = require('jsonwebtoken')
const request = require('request')

var buildWorker = function(func) {
  // https://stackoverflow.com/questions/5408406/web-workers-without-a-separate-javascript-file
  var blobURL = URL.createObjectURL(new Blob([ '(', func.toString(), ')()' ], { type: 'application/javascript' })),

  worker = new Worker(blobURL);

  // Won't be needing this anymore
  URL.revokeObjectURL(blobURL);
  return worker
}

let desktopPath = path.join(os.homedir(), 'Desktop')

let debug = remote.getGlobal('debug')
let inventory = remote.getGlobal('inventory')
let inventorySpent = remote.getGlobal('inventorySpent')
let inventoryGained = remote.getGlobal('inventoryGained')
let sortBoosters = (boosters) => {
  return boosters.sort( (a,b) => {
    if (a.collationId > b.collationId){
      return -1
    } else if (a.collationId < b.collationId){
      return 1
    } else {
      return 0
    }
  })
}

let padBoosters = (boosters) => {
  let collationIds = [100005,100006,100007,100008,100009,100010]
  for (collationId of collationIds) {
    if (!boosters.find((x) => { return x.collationId == collationId})) {
      boosters.push({collationId: collationId, count: 0})
    }
  }
  return boosters
}

var collectionData = {
  collectionPaneIndex: 'treasure',
  lastVaultProgress: remote.getGlobal('lastVaultProgress'),
  lastCollection: remote.getGlobal('lastCollection'),
  lastCollectionCount: "loading...",
  lastCollectionSetProgress: [{name: "loading..."}],
  recentCards: remote.getGlobal('recentCards'),
  recentCardsQuantityToShow: remote.getGlobal('recentCardsQuantityToShow'),
  gold: inventory.gold,
  goldSpent: inventorySpent.gold,
  goldGained: inventoryGained.gold,
  gems: inventory.gems,
  gemsSpent: inventorySpent.gems,
  gemsGained: inventoryGained.gems,
  wcCommon: inventory.wcCommon,
  wcCommonSpent: inventorySpent.wcCommon,
  wcCommonGained: inventoryGained.wcCommon,
  wcUncommon: inventory.wcUncommon,
  wcUncommonSpent: inventorySpent.wcUncommon,
  wcUncommonGained: inventoryGained.wcUncommon,
  wcRare: inventory.wcRare,
  wcRareSpent: inventorySpent.wcRare,
  wcRareGained: inventoryGained.wcRare,
  wcMythic: inventory.wcMythic,
  wcMythicSpent: inventorySpent.wcMythic,
  wcMythicGained: inventoryGained.wcMythic,
  boosters: sortBoosters(padBoosters(inventory.boosters)),
  boostersSpent: inventorySpent.boosters,
  boostersGained: inventoryGained.boosters,
}

const menu = new Menu()
const menuItem = new MenuItem({
  label: 'Inspect Element',
  click: () => {
    remote.getCurrentWindow().inspectElement(rightClickPosition.x, rightClickPosition.y)
  }
})
menu.append(menuItem)

if (debug) {
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    rightClickPosition = {x: e.x, y: e.y}
    menu.popup(remote.getCurrentWindow())
  }, false)
}

ipcRenderer.on('inventoryChanged',(e,new_inventory,new_inventory_spent,new_inventory_gained) => {
  let fields = ['gold','gems','wcCommon','wcUncommon','wcRare','wcMythic']
  for (let field of fields){
    collectionData[field] = new_inventory[field]
    collectionData[field + 'Spent'] = new_inventory_spent[field]
    collectionData[field + 'Gained'] = new_inventory_gained[field]
  }

  collectionData.boosters = null
  boosters = []
  for (booster of new_inventory.boosters){
    boosters.push(booster)
  }

  boosters = padBoosters(boosters)

  collectionData.boosters = sortBoosters(boosters)

  collectionData.boostersSpent = null
  boostersSpent = {}
  $.each(new_inventory_spent.boosters, (k,v) => {
    boostersSpent[k] = v
  })
  collectionData.boostersSpent = boostersSpent

  collectionData.boostersGained = null
  boostersGained = {}
  $.each(new_inventory_gained.boosters, (k,v) => {
    boostersGained[k] = v
  })
  collectionData.boostersGained = boostersGained
})

/**
 * Heavy handed manipulation of variables because rivets is dumb
 */
ipcRenderer.on('recentCardsChanged',(e,new_recent) => {
  let old_recent = collectionData.recentCards
  let new_recent_cards = []
  collectionData.recentCards = null
  for (let recent of old_recent) {
  	new_recent_cards.push(recent)
  }
  new_recent_cards.unshift(new_recent)
  collectionData.recentCards = new_recent_cards
})

ipcRenderer.on('lastVaultProgressChanged',(e,new_progress) => {
  collectionData.lastVaultProgress = new_progress
})

rivets.binders.showcollectionpane = (el, val) => {
  el.style.display = "none"
  if (el.attributes.value.value == val) {
    el.style.display = "block"
    $(el).find(".toggle").each(function(idx, e) {e.style.width="65px"; e.style.height="40px";})  // bad dumb hack for buttons
  }
}

rivets.binders.recentcardsbinder = (el, cardsObtained) => {
  var node;
  var textNode;
  var currentCard
  for(var cardID in cardsObtained) {
    currentCard = mtga.allCards.findCard(cardID)
    if(currentCard) {
      textNode = document.createTextNode(`${cardsObtained[cardID]}x ${currentCard.attributes.prettyName}`);
    } else {
      textNode = document.createTextNode(`${cardsObtained[cardID]}x card-name-not-found (${cardID})`);
    }
    node = document.createElement("li");
    node.style.webkitUserSelect = "auto";
    node.appendChild(textNode);
    el.appendChild(node);
  }
  if(Object.keys(cardsObtained).length > 0) {
    document.getElementById("no-recently-obtained-cards").style.display = "none";
  }
}

rivets.formatters.filterBySlideValueRecentCards = function(arr, recentCardsQuantityToShow) {
  if (arr === null || arr === undefined){
    return arr
  }
  if(recentCardsQuantityToShow >= 100) {
    return arr;
  }
  return arr.slice(0,recentCardsQuantityToShow);
}

rivets.binders.setpromo = function(el, value) {
  if (Object.keys(setPromoMap).includes(value.toString())) {
    el.style.display = "block"
    el.src = setPromoMap[value]
  } else {
    el.style.display = "none"
  }
}

rivets.binders.hidesetname = function(el, value) {
  if (Object.keys(setPromoMap).includes(value)) {
    el.style.display = "none"
  } else {
    el.style.display = "block"
  }
}

rivets.binders.mythicprogress = function(el, value) {
  el.style.width = Math.max(0, (100 * value.mythicOwned / value.mythicTotal)) + "%"
}

rivets.binders.rareprogress = function(el, value) {
  el.style.width = Math.max(0, (100 * value.rareOwned / value.rareTotal)) + "%"
}

rivets.binders.uncommonprogress = function(el, value) {
  el.style.width = Math.max(0, (100 * value.uncommonOwned / value.uncommonTotal)) + "%"
}

rivets.binders.commonprogress = function(el, value) {
  el.style.width = Math.max(0, (100 * value.commonOwned / value.commonTotal)) + "%"
}

rivets.binders.netinv = (el,change) => {
  let $el = $(el)
  $el.text(change)
  if (change > 0){
    $el.addClass('gained')
    $el.removeClass('spent')
  } else if (change < 0) {
    $el.addClass('spent')
    $el.removeClass('gained')
  } else {
    $el.removeClass('spent')
    $el.removeClass('gained')
  }
}

rivets.binders.boostersgained = (el,collectionId) => {
  let $el = $(el)
  let change = collectionData['boostersGained'][collectionId]
  $el.text(change)
  if (change > 0){
    $el.removeClass('spent')
    $el.addClass('gained')
  } else {
    $el.removeClass('spent')
    $el.removeClass('gained')
  }
}

rivets.binders.boostersspent = (el,collectionId) => {
  let $el = $(el)
  let change = collectionData['boostersSpent'][collectionId]
  $el.text(change)
  if (change > 0){
    $el.addClass('spent')
    $el.removeClass('gained')
  } else {
    $el.removeClass('spent')
    $el.removeClass('gained')
  }
}

rivets.binders.netboosters = (el,collationId) => {
  let change = collectionData['boostersGained'][collationId] - collectionData['boostersSpent'][collationId]
  let $el = $(el)
  $el.text(change)
  if (change > 0){
    $el.addClass('gained')
    $el.removeClass('spent')
  } else if (change < 0) {
    $el.addClass('spent')
    $el.removeClass('gained')
  } else {
    $el.removeClass('spent')
    $el.removeClass('gained')
  }
}

collectionData.netGold = () => {
  return collectionData.goldGained - collectionData.goldSpent
}

collectionData.netGems = () => {
  return collectionData.gemsGained - collectionData.gemsSpent
}

collectionData.netDraftTokens = () => {
  return collectionData.draftTokensGained - collectionData.draftTokensSpent
}

collectionData.netWcCommon = () => {
  return collectionData.wcCommonGained - collectionData.wcCommonSpent
}

collectionData.netWcUncommon = () => {
  return collectionData.wcUncommonGained - collectionData.wcUncommonSpent
}

collectionData.netWcRare = () => {
  return collectionData.wcRareGained - collectionData.wcRareSpent
}

collectionData.netWcMythic = () => {
  return collectionData.wcMythicGained - collectionData.wcMythicSpent
}

const setPromoMap = {
  XLN: "img/card_set_promos/xln.png",
  100005: "img/card_set_promos/xln.png",
  RIX: "img/card_set_promos/rix.png",
  100006: "img/card_set_promos/rix.png",
  DAR: "img/card_set_promos/dar.png",
  100007: "img/card_set_promos/dar.png",
  M19: "img/card_set_promos/m19.png",
  100008: "img/card_set_promos/m19.png",
  GRN: "img/card_set_promos/grn.png",
  100009: "img/card_set_promos/grn.png",
  RNA: "img/card_set_promos/rna.png",
  100010: "img/card_set_promos/rna.png",
  ANA: "img/card_set_promos/ana.png",
}

function recentCardsSectionClickHandler(event) {
  var revealed = $(event.target).siblings(".recent-cards-container").is(":hidden");
  if(revealed) {
    $(event.target).siblings(".recent-cards-container").slideDown("fast");
  } else {
    $(event.target).siblings(".recent-cards-container").slideUp("fast");
  }
}

document.addEventListener("DOMContentLoaded", function(event) {
  rivets.bind(document.getElementById('container'), collectionData)
  let collectionWorker = buildWorker(e => {
    var allCards;
    var cardSets = {}
    var playerCardCounts = {}
    onmessage = event => {
      if (event.data.allCards) {
        allCards = event.data.allCards.attributes.cards;
        // Note: this block of code looks really stupid, but trust me, it's necessary.
        // TL:DR; you can't `require(...)` inside webworkers, so we lose all of the cool mtga functionality.
        // As if that wasn't bad enough: since mtga uses backbone BS, we have to do silly things to
        // get to the actual objects within the allCards object.
        // Anyways, this block of code basically redoes all the organization that mtga originally offered in the
        // first place. :tiny_violin:
        for (let cardID in allCards) {
          let thisCard = allCards[cardID].attributes
          if (!cardSets[thisCard.set]) {
            cardSets[thisCard.set] = {
              cards: [],
              counts: {
                mythicTotal: 0,
                rareTotal: 0,
                uncommonTotal: 0,
                commonTotal: 0
              }
            }
          }
          if (!thisCard.collectible) continue;
          let thisCardsSet = cardSets[thisCard.set]
          thisCardsSet.cards.push(thisCard)
          // add 4 for each unique card; you can collect 4 of each
          if (thisCard.rarity == "Mythic Rare") {
            thisCardsSet.counts.mythicTotal += 4;
          } else if (thisCard.rarity == "Rare") {
            thisCardsSet.counts.rareTotal += 4;
          } else if (thisCard.rarity == "Uncommon") {
            thisCardsSet.counts.uncommonTotal += 4;
          } else if (thisCard.rarity == "Common") {
            thisCardsSet.counts.commonTotal += 4;
          }
        }
        console.log(cardSets)
        postMessage({ready: true})
      } else if (event.data.lastCollection) {
        let total = 0;
        let unique = 0;
        let collection = event.data.lastCollection;
        console.log(Object.keys(allCards))
        for (let key in collection) {
          if (collection[key] && Number.isInteger(collection[key])) {
            if (Object.keys(allCards).includes(key)) {
              let thisCard = allCards[key].attributes
              let thisCardsSet = cardSets[thisCard.set]
              if (!Object.keys(playerCardCounts).includes(thisCard.set)) {
                playerCardCounts[thisCard.set] = thisCardsSet.counts
                playerCardCounts[thisCard.set].name = thisCard.set
                playerCardCounts[thisCard.set].mythicOwned = 0
                playerCardCounts[thisCard.set].rareOwned = 0
                playerCardCounts[thisCard.set].uncommonOwned = 0
                playerCardCounts[thisCard.set].commonOwned = 0
              }

              if (thisCard.rarity == "Mythic Rare") {
                playerCardCounts[thisCard.set].mythicOwned += collection[key];
              } else if (thisCard.rarity == "Rare") {
                playerCardCounts[thisCard.set].rareOwned += collection[key];
              } else if (thisCard.rarity == "Uncommon") {
                playerCardCounts[thisCard.set].uncommonOwned += collection[key];
              } else if (thisCard.rarity == "Common") {
                playerCardCounts[thisCard.set].commonOwned += collection[key];
              }
              playerCardCounts[thisCard.set]
            }
            total += collection[key]
            unique += 1
          }
        }

        const collationIds = {
          'ANA': -1,
          'XLN': 100005,
          'RIX': 100006,
          'DAR': 100007,
          'M19': 100008,
          'GRN': 100009,
          'RNA': 100010,
        }

         playerCardCounts = Object.values(playerCardCounts).sort((a,b) => {
          if (collationIds[a.name] < collationIds[b.name]) {
            return 1
          } else if (collationIds[a.name] > collationIds[b.name]) {
            return -1
          } else {
            return 0
          }
        })
        postMessage({
          lastCollectionCount: `${unique} unique cards, ${total} total cards`,
          playerCardCounts:playerCardCounts,
        })
      }
    }
    // for(;;) {}; // use this to loop forever, and test that hung worker doesn't make window hang
  })

  collectionWorker.onmessage = event => {
    if (event.data.lastCollectionCount) {
      collectionData.lastCollectionCount = event.data.lastCollectionCount
      collectionData.lastCollectionSetProgress = event.data.playerCardCounts
    } else if (event.data.ready) {
      collectionWorker.postMessage({lastCollection: collectionData.lastCollection})
    }
  }
  collectionWorker.postMessage({allCards: mtga.allCards})

  $(".nav-group-item").click((e) => {
    $('.nav-group-item').removeClass('active')
    if (e.target.attributes.value != undefined){
      collectionData.collectionPaneIndex = e.target.attributes.value.value
      $(e.target).addClass('active')
    } else {
      collectionData.collectionPaneIndex = e.target.parentNode.attributes.value.value
      $(e.target.parentNode).addClass('active')
    }
  })

  $("#exportCollectionMTGGButton").click((e) => {
    console.log("exporting mtgg to desktop")
    let allPromises = []
    for (let cardKey in collectionData.lastCollection) {
      allPromises.push(mtga.allCards.findCard(cardKey))
    }

    Promise.all(allPromises).then(allCards => {
      let mtggExportPath = path.join(desktopPath, 'mtga_collection_mtggoldfish.csv')
      let csvContents = "Name,Edition,Qty,Foil\n"
      for (let card of allCards) {
        if (card) {
          let mtgaID = card.get("mtgaID")
          let prettyName = card.get("prettyName")
          let set = card.get("set")
          if (set == "DAR") set = "DOM"  // sigh, c'mon arena devs
          let count = collectionData.lastCollection[mtgaID]
          csvContents +=`"${prettyName}",${set},${count},No\n`
        }
      }
      fs.writeFile(mtggExportPath, csvContents, (err) => {
        if (err) {
          alert(`error saving export: ${err}`)
        } else {
          alert(`Saved to ${mtggExportPath} !`)
        }
      })
    })
  })

  document.getElementById("recent-cards-quantity-slider").value = "" + collectionData.recentCardsQuantityToShow;
  let initialValueRecentCardsQuantityToShow = collectionData.recentCardsQuantityToShow;
  if(initialValueRecentCardsQuantityToShow == 100) {
    initialValueRecentCardsQuantityToShow = "∞"
  }
  $(".slidevalue-recent-cards").html(initialValueRecentCardsQuantityToShow)
  document.getElementById("recent-cards-quantity-slider").onchange = function() {
    let value = parseInt(this.value)
    collectionData.recentCardsQuantityToShow = value;
    ipcRenderer.send('settingsChanged', {key: "recentCardsQuantityToShow", value: value})
  }
  document.getElementById("recent-cards-quantity-slider").oninput = function() {
    let value = this.value
    collectionData.recentCardsQuantityToShow = value;
    if(value == 100) {
      value = "∞"
    }
    $(".slidevalue-recent-cards").html(value);
  }
})
