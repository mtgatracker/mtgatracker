# Privacy Policy

MTGATracker's core contributors ("us", "we", "our") manages source code ("the code"), distributes the application ("the app")
and operates and maintains MTGATracker.com ("the site"). This document is to inform users of our policies regarding to the
collection, use, and disclosure of data we receive from users of the app, the site, or contributors to
the code.

**MTGATracker tracks and stores game data from MTG Arena.** We hope this does not come as a surprise to our users,
based on the name of the project. You can read more specifics about the data we
track [below](https://github.com/shawkinsl/mtga-tracker/blob/master/privacy.md#specifically-what-data-does-mtgatracker-track-and-how-often), as well as
find out how to [opt-out](https://github.com/shawkinsl/mtga-tracker/blob/master/privacy.md#how-do-i-opt-out-turning-on-incognito-mode).

We are required per [Google Analytics](https://www.google.com/analytics/terms/us.html) terms to share a privacy policy.
None of us are lawyers; this is a document written by non-lawyer humans as a courtesy, and is not a legal document.

## Definitions

### Linkable information

"Linkable Information" includes data that reasonably could be tied to an individual, but does not inherently do so. We
consider things like IP Addresses, data about browsers, country-of-origin, etc. to be "Linkable information,"
but not "Personal Information," or "Platform Information"

### Personal Information

"Personal Information" includes data that de-facto represents an individual. We consider things
like email addresses, full names, phone numbers, and mailing addresses to be "Personal Information." **We
do not collect or store any personal information.**

### Secure Information

"Secure Information" includes secret and private data such as passwords. We do not collect any secure information.

### Platform Information

"Platform Information" includes data that represents an individual's persona in MTGA. We consdier things like MTGA
usernames, deck titles, deck contents, win ratios, etc to be "Platform Information." We consider Platform Information
to be adjacent to and distinct from Personal Information, similar to Linkable Information.

If a user chooses to encode personal information into platform information (for example, a user
selecting a title for a deck that is also their home address), this use case would be a bizarre misuse of the
platform, in which MTGATracker is not liable. Encoding personal information into platform information
is done so at the user's own risk.

## Our data policy

We will never sell any of your information to any third parties. Ever.

If we ever do use Personal Information, we will do so only to operate and improve the app and the site.
We must use third parties to process information from any of the definitions above, but we will we never
display Linkable Information publicly to any user other than the owner of that information. We also
will never share Personal Information with any 3rd party without your express permission
for any reason other than to operate the app and site. Again, we do not collect Personal Information, but 
if we ever do, we will not share it with or sell it to any third party.

We do share Linkable Information discovered on the site with analytics services (namely, Google Analytics, which you
can read more about [here](https://www.google.com/policies/privacy/partners/)). We only share this information to
understand our usage history, understand the scaling challenges ahead, plan future solutions, and generally to improve
the app and site. Note that we do not collect, store, or retain Linkable Information in any form.

We reserve the right to share Linkable Information with advertisement agencies. We will never share Personal
Information (which we do not collect) or Platform Information with any third party for the purpose of monetary gain.
We may intentionally share Platform Information with other services with your express permission for each service.

We will endeavor to anonymize Platform Information before sharing it publicly, but we reserve the right to
share Platform Information in it's raw form with any authenticated user with a need to see that
information (for example, if you played a game against User A, it is reasonable that that game's data will
also be visible to User A.) We will not, without your permission, share specifics of your platform information publicly.
For example, we will not share the contents of a specific deck, your deck's name, or your username
publicly. However, we reserve the right to share anonymous aggregate data publicly.

Here are some examples of information we will **not** share without permission:

- User Gemma1234 has played 200 games with merfolk!
- User James9876 has a playset of Belzenlock's!
- User xXxJ4CExXx has 27 decks, all of which are blue!
- User SPIKEBEST has won 3,000 games!
- Somewhere between one and nine anonymous users are running this exact decklist!

Here are some examples of information **we do** reserve the right to share publicly:

- 10+ anonymous users are running this exact decklist!
- The most rats used in any deck tracked with MTGATracker is 55, by an anonymous user.
- The largest land count ever used in a deck in MTGATracker is 40, by an anonymous user running a green deck. The smallest is 2, by an anonymous user running a red deck.
- The highest winrate of any user is 200:6, by an anonymous user.
- 43% of all blue green decks dracked contain at least these 30 cards
- 15% of users use or have used at least one profanity in the names of their decks
- The Scarab god has been used in 98% of all decks tracked with MTGATracker!
- No one has ever used Sphinx's Decree in any game tracked by MTGATracker, ever!

## Specifically, what data does MTGATracker track, and how often?

_Last updated with version 3.0.0_

MTGATracker sends one request to our servers at the end of each game played with the tracker running.
The following is an example payload sent to our server **with incognito mode enabled**:

```
{
  "anonymousUserID": "<hash>",  /* this is a hash (numeric representation) of your MTGA username */
  "date": "2018-05-08 14:40:26.809448"
}
```

The following is what the database goes on to store after the request has been processed:

```
{
  "anonymousUserID": "<hash>",  /* this is a hash (numeric representation) of your MTGA username */
  "date": "2018-05-08 14:40:26.809448"
}
```

In this case, no user entry will be generated.

The following is an example payload sent to our server **without incognito mode enabled.** Some fields have been
partially obscured, the opponent's name has been redacted, and the opponent's deck has been replaced with the 
partial contents of one of Spencatro's decks, but the record is otherwise real:

```
{"client_version": "2.1.0-beta",
 "date": "2018-05-08 03:20:36.619000",
 "gameID": "...R3D4CT3D...",
 "game_hash": "...R3D4CT3D...",
 "hero": "Spencatro",
 "opponent": "Opponent's MTGA Username",
 "players": [{"deck": {"cards": {"65081": 2,
     "65463": 2,
     "65643": 1,
     "65683": 1,
     "65687": 1,
     "66173": 1,
     "66177": 1,
     "66185": 1,
     "66189": 1,
     "66225": 1,
     "66237": 1,
     "66239": 1,
     "66249": 1,
     "66251": 2,
     "66263": 1,
     "66279": 2,
     "66289": 1,
     "66411": 2,
     "66449": 1,
     "66753": 1,
     "66761": 2,
     "66765": 2,
     "66783": 1,
     "66809": 1,
     "66813": 2,
     "66819": 2,
     "66827": 1,
     "66851": 1,
     "66929": 2,
     "67019": 9,
     "67021": 12},
    "deckID": "...R3D4CT3D...",
    "poolName": "The Brazen Coalition"},
   "name": "Spencatro",
   "userID": "...R3D4CT3D..."},
  {"deck": {"cards": {"-1": 39,
     "66003": 2,
     "66009": 1,
     "66029": 1,
     "66175": 2,
     "66185": 4,
     "66219": 2,
     "66223": 2,
     "66431": 1,
     "66619": 2,
     "66627": 2,
     "66631": 2},
    "deckID": "unknown",
    "poolName": "Opponent's MTGA Username's visible cards"},
   "name": "Opponent's MTGA Username",
   "userID": "...R3D4CT3D..."}],
 "winner": "Spencatro"}
```

The following is what the database goes on to store after the request has been processed:

```
{"_id": ObjectId('...R3D4CT3D...'),
 "clientVersionOK": true,
 "client_version": "2.1.0-beta",
 "date": "2018-05-08 03:20:36.619000",
 "gameID": "...R3D4CT3D...",
 "game_hash": "...R3D4CT3D...",
 "hero": "Spencatro",
 "latestVersionAtPost": "2.1.0-beta",
 "opponent": "Opponent's MTGA Username",
 "players": [{"deck": {"cards": {"65081": 2,
     "65463": 2,
     "65643": 1,
     "65683": 1,
     "65687": 1,
     "66173": 1,
     "66177": 1,
     "66185": 1,
     "66189": 1,
     "66225": 1,
     "66237": 1,
     "66239": 1,
     "66249": 1,
     "66251": 2,
     "66263": 1,
     "66279": 2,
     "66289": 1,
     "66411": 2,
     "66449": 1,
     "66753": 1,
     "66761": 2,
     "66765": 2,
     "66783": 1,
     "66809": 1,
     "66813": 2,
     "66819": 2,
     "66827": 1,
     "66851": 1,
     "66929": 2,
     "67019": 9,
     "67021": 12},
    "deckID": "...R3D4CT3D...",
    "poolName": "The Brazen Coalition"},
   "name": "Spencatro",
   "userID": "...R3D4CT3D..."},
  {"deck": {"cards": {"-1": 39,
     "66003": 2,
     "66009": 1,
     "66029": 1,
     "66175": 2,
     "66185": 4,
     "66219": 2,
     "66223": 2,
     "66431": 1,
     "66619": 2,
     "66627": 2,
     "66631": 2},
    "deckID": "unknown",
    "poolName": "Opponent's MTGA Username's visible cards"},
   "name": "Opponent's MTGA Username",
   "userID": "...R3D4CT3D..."}],
 "winner": "Spencatro"}
```

The following is what MTGATracker stores for each user record, created the first time a user
completes a game with the tracker running:

```
{"_id": ObjectId("...R3D4CT3D..."),
 "available": false,
 "isUser": true,
 "publicName": "Fearless_Inquisitor",
 "username": "Spencatro"}
```

The following is what MTGATracker stores for each user record, after it has been updated by logging in to
inspector for the first time:

```
{"_id": ObjectId("...R3D4CT3D..."),
 "auth": {"accessCode": 123456,
          "expires": "2018-05-08 00:10:53.240000"},
 "available": false,
 "discordID": "...R3D4CT3D...",
 "discordUsername": "Spencatro#6059",
 "isUser": true,
 "publicName": "Fearless_Inquisitor",
 "username": "Spencatro"}
```

## What data does MTGATracker share and with whom?

- MTGATracker stores all information in an undisclosed DBaaS. If you would like more information about
this, please contact us at devs.mtgatracker@gmail.com .

- MTGATracker uses webtask.io to process all requests. You can read about their privacy
policy [here](https://auth0.com/privacy), and their security practices [here](https://auth0.com/security).

- MTGATracker must "share" your IP address with Google Analytics.

- MTGATracker "shares" the following information with discord (to message you your accessCode during inspector login)
  - Your discord username
  - Your MTGA username
  - Your unique, rolling login accessCode's
  - Your accessCode's expiration date
  
## How do I opt out? (Turning on "incognito mode")

+![Where to enable incognito mode](https://raw.githubusercontent.com/shawkinsl/mtga-tracker/master/.readme_data/incognito.png)


- Open MTGATracker
- Click the settings button
- Select the "privacy" tab
- Enable "Incognito Mode"


If you would like to better understand how any of your data is used, please feel free to ask
our developers [on discord](https://discord.gg/Ygfv25w) or via email (devs.mtgatracker@gmail.com)
(or just look through the code)! Contributors will be more than happy to explain, improve, or remove ways we handle your data, whenever necessary.

If you at any time would like data related to you to be archived or removed from MTGATracker systems, contact devs.mtgatracker@gmail.com .
