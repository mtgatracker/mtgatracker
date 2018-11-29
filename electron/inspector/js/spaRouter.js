const { deckRoute } = require("./deck")
const { decksRoute } = require("./decks")
const { draftRoute } = require("./draft")
const { draftsRoute } = require("./drafts")
const { profileRoute } = require("./profile")
const { gameRoute } = require("./game")
const { homeRoute } = require("./home")
const { getDecks, getGames } = require("./api")
const { localDB, pagePrefix} = require('./conf.js')

const { adminRoute } = require("./admin")

let parseQuerystring = (ctx, next) => {
  let cleanQuerystring = ctx.querystring.split("#")[0]
  let args = cleanQuerystring.split("&")
  let params = {}
  args.forEach(arg => {
    if (arg.includes("=")) {
      let parts = arg.split("=")
      let key = parts[0]
      let value = parts[1]
      params[key] = value
    } else {
      params[arg] = true
    }
  })
  Object.assign(ctx.params, params)
  next()
}

let scrollTop = (ctx, next) => {
  window.scrollTo(0,0);
  next()
}

$(function() {
    // all API requests might return a new token. If we get one, set it.
    console.log(window.location)
    page(`/`, scrollTop, homeRoute)
    page(`/deck/`, scrollTop, parseQuerystring, deckRoute)
    page(`/decks/`, scrollTop, parseQuerystring, decksRoute)
    page(`/draft/`, scrollTop, parseQuerystring, draftRoute)
    page(`/profile/`, scrollTop, parseQuerystring, profileRoute)
    page(`/drafts/`, scrollTop, parseQuerystring, draftsRoute)
    page(`/game/`, scrollTop, parseQuerystring, gameRoute)
    page(`/admin/`, scrollTop, parseQuerystring, adminRoute)
    page({click: true, hashbang: true})
})
