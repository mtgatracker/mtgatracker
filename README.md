# MTGA Tracker
Collection of tools built up around the MTGA Client logs

## Native App
**Backend**

The back end is at it's core a python log parser project. There's a websockets app tacked on top to communicate state with
the frontend.

**Front end**

The front end of MTGA Tracker is an electron app that uses node / websocket to communicate with the backend

## Project layout

`app` - python backend for watching MTGA logs

`electron` - native electron app

`scripts` - various scripts and utilities. either one-time use, or just don't really fit anywhere

`webtasks` - node.js / webtask.io code for webapp and app to talk to

`webapp` - code for mtga-tracker.com