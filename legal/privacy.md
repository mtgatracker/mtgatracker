# Privacy Policy

MTGATracker's core contributors ("us", "we", "our") manage source code ("the code"), distribute the
application ("the app") and operate and maintain MTGATracker.com ("the site"). This document serves
to inform users of our policies regarding the collection, use, and disclosure of data we receive from users of
the app, the site, or contributors to the code.

**MTGATracker tracks and stores game data from MTG Arena.** (We hope this does not come as a surprise to our users,
based on the name of the project.) 
Generally, actionable user-specific data is only stored on a user's local machine, and is not communicated
in any actionable form to MTGATracker servers. You can read more specifics about the data we track
[below](https://github.com/shawkinsl/mtga-tracker/blob/master/legal/privacy.md#specifically-what-data-does-mtgatracker-track-and-how-often).

We are required, per [Google Analytics](https://www.google.com/analytics/terms/us.html) terms, to share a privacy policy.
None of us are lawyers; this is a document written by non-lawyer humans as a courtesy, and to satisfy Privacy Policy laws to the
best of our ability wherever applicable.

## Updates to this policy

MTGATracker is always getting better with new features & bug fixes. As MTGATracker evolves, this policy is
also subject to change with it, at any time. Notice of updates to this document may be provided to you via
notifications within MTGATracker. You may also see a live history of this file at any time by visiting the
following [link](https://github.com/mtgatracker/mtgatracker/commits/master/legal/privacy.md).

_Last updated with version 5.0.0_

## Definitions

### Personally Identifiable Information

Personally Identifiable Information ("PII") is a term used in legal documents such as the EU General Data Protection
Regulation ("GDPR"). In the case of GDPR, it refers to information that can be used to identify an individual
(i.e. by real name or home address, etc).

The legal nature of if the data collected with MTGATracker is considered PII is ambiguous; we do not legally consider
any of the information MTGATracker collects to be PII, as none of this information
can lead back to an identifiable individual (i.e. your real name or home address, etc) by use of our data sources alone.
**However,** we will endeavor anyways to protect information from
any category listed below as if it were. We will always ask for your consent before
sharing information from any category listed below with any party for any reason other than to
directly provide MTGATracker's services as outlined in our Terms of Service. For example, we will not
share information from any category below with marketing partners without your consent to do so.

### Linkable information

"Linkable Information" includes data that reasonably could be tied to a user, but does not inherently do so. We
consider things like anonymized IP Addresses, Unique Identity Codes from Identity Providers, Preferred Usernames
from Identity Providers (e.g. Twitch or Discord usernames), data about browsers,
country-of-origin, etc. to be "Linkable information," but not "Individual Person Information,"
or "Platform Information." In general, we prefer to anonymize Linkable information whenever possible.

### Individual Person Information

"Individual Person Information" includes data that de-facto represents an individual. We consider things
like email addresses, full names, phone numbers, and mailing addresses to be "Individual Person Information." **We
do not process, collect, store, or share any Individual Person Information.**

### Secure Information

"Secure Information" includes secret and private data such as passwords. We provide a service that is
fully passwordless, and "accountless,"
and as such, we do not process, collect, store, or share any secure information.

### Platform Information

"Platform Information" includes data that represents an individual's persona & play history in MTGA. We consider things
like MTGA usernames, deck titles, deck contents, win/loss ratios, etc to be "Platform Information."
We consider Platform Information to be adjacent to and distinct from Individual Person Information,
similar to Linkable Information.

If a user chooses to encode Individual Person Information into platform information (for example, a user
providing a title for a deck that is also their home address), this use case would be a bizarre misuse of the
platform, in which MTGATracker is not liable. Encoding Individual Person Information into platform information
is done so at the user's own risk, and we are not responsible or liable to protect this data as such if you
choose to do so.

## Our data policy

### Legal Basis

While we do not consider any information MTGATracker collects to be Individual Person Information, our legal
basis for processing & storing any data that may be considered PII (namely, pseudo-randomly generated Tracker ID's),
now or in the future is and will always be to fulfill the contract of providing individual MTGA Game Data Analysis to
individual users, as outlined in the MTGATracker [Terms of Services](https://github.com/mtgatracker/mtgatracker/commits/master/legal/tos.md),
per GDPR Article 6(1)(b).

While you must agree to our Terms of Services in order to use MTGATracker services,
your agreement to the Terms of Services contract _is not_ considered consent for your
information to be used for marketing purposes, or any other purpose than to directly carry out our contract with you.
Before using your information for any purposes outside of fulfilling the contract outlined in our Terms of Services,
we will ask for your consent. We ask for "soft-consent" and point you to this document from our downloads page only as a courtesy,
as well as to notify you of your ability to opt-out of our data processing, collection, and storage entirely.

### What we do and don't do with your data

We will never sell any of your information to any third parties. Ever.

If we ever do use Individual Person Information or PII, we will do so only to operate and improve the app and the site.
We must use third parties to process information from any of the definitions above, but we will we never
display Linkable Information (e.g. your Twitch / Discord username) publicly to any user other than the owner of
that information without that user's specific and express permission.
We also will never share your information with any 3rd party without
your express permission for any reason other than to operate the app and site. Again, we do not process,
collect, store, or share Individual Person Information, but if we ever do, we will not share it with or
sell it to any third party without your freely-given consent.

We do share anonymized IP Addresses sent to the site with analytics services
(namely, Google Analytics, which you can read more about [here](https://www.google.com/policies/privacy/partners/)).
We only share this information to understand our usage history, understand the
scaling challenges ahead, plan future solutions, and generally to improve
the app and site. Note that we do not collect or store IP Addresses in any form, and we do not
share any Individual Person Information or PII with Google Analytics--not even your entire IP address.

We reserve the right to share raw data from any category with individuals affiliated with MTGATracker for the
purpose of fulfilling MTGATracker's contract outlined in our Terms. These individuals will always have signed
non-disclosure agreements on file.

We may share Platform Information with other services with your express permission for each service & 
use case, each of which, if any at all, will be outlined later in this document.

### How long do we keep data

MTGATracker data is kept generally for a maximum of three months. **Data collected with clients <= 4.5.5 is set to expire in March 2019.**

## Specifically, what data does MTGATracker collect, and how often?

### Game Information

MTGATracker sends one request to our servers at the end of each game played with the tracker running. This request
contains a bare-bones payload that we use strictly to bump the "total matches tracked" counter on
our homepage, and to verify that application updates are generally succeeding to a majority of users. It does not
contain any actionable user or game-state information, but only _hashed_ representations of certain fields to ensure
uniqueness of both the user and game for the purposes of calculating tallies. Since this is the case, as of 5.0.3,
there is no "incognito" option, as this option would generally be misleading.

The following is an example payload sent to our server at the end of a game

```
{
  "anonymousUserID": "<hash>",  /* this is a hash (numeric representation) of your tracker ID--it is NOT related to any MTGA data, or identifiable usernames. */
  "date": "2018-05-08 14:40:26.809448",
  "client_version": "5.0.3",
  "gameID": "<hash>"  /* this is a hash (numeric representation) of your game record, used strictly to guarantee uniqueness. No game state can be determined from this hash.*/
}
```

## DEPRECATED: 4.5.5 and previous

This information only applies to MTGATracker clients 4.5.5 and below. It does not apply to 5.0.0 forward,
and is only included for historical reference. **This documentation will be removed in March, 2019!**

<details><summary>Expand...</summary>

With versions 5.0.0+, MTGATracker API's no longer record game data, so even if a <= 4.5.5 client makes a request
to our servers with the following data, it will be rejected / ignored. This applies for any section below labeled
"(Deprecated)"

### Game Information (Deprecated)

In versions 4.5.5 and below, MTGATracker would send one request to our servers at the end of each game played with
the tracker running, and one request whenever a rank change event was observed. (Deprecated)

The following is an example payload that is sent to our server at the end of a game in <= 4.5.5
**with incognito mode enabled**: (Deprecated)

```
{
  "anonymousUserID": "<hash>",  /* this is a hash (numeric representation) of your MTGA username */
  "date": "2018-05-08 14:40:26.809448"
}
```

In this case, no user entry will be generated.

The following is an example payload sent to our server at the end of a game in <= 4.5.5
**without incognito mode enabled.** Some fields have been
partially obscured, the opponent's name has been redacted, and the opponent's deck has been replaced with the 
partial contents of one of Spencatro's decks, but the record is otherwise real: (Deprecated)

```
{"client_version": "3.5.5",
 "date": "2018-05-08 03:20:36.619000",
 "gameID": "...R3D4CT3D...",
 "game_hash": "...R3D4CT3D...",
 "hero": "Spencatro",
 "opponent": "Opponent's MTGA Username",
 "turnNumber": 10,
 "elapsedTime": "0:04:57.944322",
 "currentPlayer": "Morethanafro",
 "currentPhase": "Phase_Main1",
 "onThePlay": "Spencatro",
 "opponentStartingRank": "Gold 4",
 "eventID": "CompCons_DOM_06072018",
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
    "playedCards": {
     "65463": 2,
     "65643": 1,
     "65683": 1,
     "65687": 1,
     "66411": 2,
     "66449": 1,
     "66753": 1,
    },
    "timeSpent": "0:00:42.856671",
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
   "timeSpent": "0:01:12.86429",
   "userID": "...R3D4CT3D..."}],
 "winner": "Spencatro"}
```

When incognito mode is enabled, no requests are sent when rank changes are observed in MTGATracker.

The following is an example payload sent to our server when a rankChange event is observed in <= 4.5.5
**without incognito mode enabled** (Deprecated)

```
{
   "playerId": "...R3D4CT3D...",
   "newTier": 1,
   "oldTier": 1,
   "newClass": "Silver",
   "oldClass": "Silver",
   "oldProgress": 59.88731236824992,
   "newProgress": 48.64644868982941,
   "newStreak": 0,
   "oldStreak": 0,
   "rankUpdateType": "Constructed",
   "block_title": "Rank.Updated",
   "block_title_sequence": "398"
}
```

When incognito mode is enabled, no requests are sent when inventory changes (gold, gems, or vault progress)
are observed in MTGATracker.

MTGATracker sends a request to our servers when it detects a change in a user's inventory. The following is an example
payload sent to our servers on an inventory change event **without incognito mode enabled.** (Deprecated)

```
{
    "type": "gold",
    "value": 20175,
    "playerId": "...R3D4CT3D...",
}

```

When incognito mode is enabled, no requests are sent when draft picks are observed in MTGATracker.

MTGATracker sends a request to our servers when a draft pick is observed. The following is an example
payload sent to our servers on an draft pick event **without incognito mode enabled.** (Deprecated)

```
{
    "playerID": "...R3D4CT3D...",
    "pickNumber": 1,
    "packNumber": 0,
    "pack": [
        67916,
        68078,
        67972,
        67844,
        67928,
        67756,
        68040,
        67944,
        68172,
        67958,
        67790,
        67960,
        68154,
        68182
    ],
    "pick": 68182
},
```

### User information (Deprecated)

The following is what MTGATracker stores for each user record, created the first time a user
completes a game with the tracker running: (Deprecated)

```
{"_id": ObjectId("...R3D4CT3D..."),
 "available": false,
 "isUser": true,
 "publicName": "Fearless_Inquisitor",
 "username": "Spencatro"}
```

The following is what MTGATracker stores for each user record, after it has been updated by logging in to
Inspector for the first time: (Deprecated)

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

</details>

## What data does MTGATracker share and with whom?

- MTGATracker stores all information in an undisclosed DBaaS. If you would like more information about
this, please contact us at devs.mtgatracker@gmail.com .

- MTGATracker uses webtask.io to process all remote requests. You can read about their privacy
policy [here](https://auth0.com/privacy), and their security practices [here](https://auth0.com/security).

- When you visit MTGATracker.com, MTGATracker.com shares your incomplete IP address, anonymized by dropping the last
octet (192.126.90.123 -> 192.168.90.0), with Google Analytics.

#### The Right to be Forgotten

You have the right to request a copy of all data stored in MTGATracker about you. To do so, please contact us at
devs.mtgatracker@gmail.com .
If you at any time would like data related to you to be archived or removed from MTGATracker systems,
please contact devs.mtgatracker@gmail.com .
 
Note that these requests will require platform-based challenges to verify your identity in order to complete them.

## Contact us about this policy

If you would like to better understand how any of your data is used, please feel free to ask
our developers [on Discord](https://discord.gg/Ygfv25w) or via email (devs.mtgatracker@gmail.com)
Our core contributors will be more than happy to explain, improve, or remove the ways in which we
handle your data, whenever necessary.
