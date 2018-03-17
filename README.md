# MTGA Tracker
MTGA Tracker is an electron-based app that helps you track your MTGA decks!

## I'm not reading anything else until you tell me how to use it

I figured as much. Make sure you have all of the following installed:
- [python3.6+](https://www.python.org/downloads/)
- [node.js / npm](https://nodejs.org/en/download/)
- (optional, but recommended) [Git Bash](https://git-scm.com/downloads)

Note that if you choose to skip Git Bash, you're on your own w.r.t. formatting shell commands.

1. Open Git Bash
1. Make sure python is installed by typing: `python --version` . You should see:
    ```bash
    Spencatro@LAPTOP-2K3EQNOB ~
    λ python --version
    Python 3.6.4
    ```
1. Make sure npm is installed by typing: `npm --version` .  You should see:
    ```bash
    Spencatro@LAPTOP-2K3EQNOB ~
    λ npm --version
    5.6.0
    ```
1. Run these commands # TODO: verify this
    ```bash
    cd /c/path/where/you/want/the/code
    git clone https://github.com/shawkinsl/mtga-tracker.git
    cd mtga-tracker
    # next 4 lines """optional"""
    python -m ensurepip
    pip install virtualenv --user
    python -m virtualenv venv
    source venv/Scripts/activate
    # read more about virtualenv here: http://www.pythonforbeginners.com/basics/how-to-use-python-virtualenv
    pip install -r requirements.txt
    cd electron
    npm install .
    ```
1. If all went well, you should now be able to:
    ```bash
    ./node_modules/.bin/electron .
    ```
    And the decktracker UI should launch!

## Docs

### Native App
**Backend**

The back end is at it's core a python log parser project. There's a websockets app tacked on top to communicate state with
the frontend.

**Front end**

The front end of MTGA Tracker is an electron app that uses node / websocket to communicate with the backend

### Project layout

`app` - python backend for watching MTGA logs

`electron` - native electron app

`scripts` - various scripts and utilities. either one-time use, or just don't really fit anywhere

`webtasks` - node.js / webtask.io code for webapp and app to talk to

`webapp` - code for mtga-tracker.com

### Disclaimers

Use MTGA Tracker at your own risk. Your account may be banned for using this software; MTGA Tracker and its developers
are not responsible if this happens. Note that this outcome seems unlikely, but Wizards has yet to acknowledge this project in
any setting. Here are the attempts we've made to get comments from wizards:
[beta forums 1](https://mtgarena.community.gl/forums/threads/14685)
[beta forums 2](https://mtgarena.community.gl/forums/threads/12269)
[beta forums 2](https://mtgarena.community.gl/forums/threads/12269)
[discord](https://discordapp.com/channels/167375953561911296/356107498778001409?jump=420293602690859029)
![discord screenshot](https://github.com/shawkinsl/mtga-tracker/blob/master/.readme_data/discord.JPG?raw=true)
[reddit (todo after NDA drops)](#) 
Note that while this outcome is unlikely, it is certainly possible.

It is entirely possible that Wizards of the Coast will disable all logging and completely wreck this project. While 
we certainly do not hope this will happen, it is worth noting that this project may stop working at any time. In the
event that this happens, please verify that what you are experiencing is a software issue, and if it is not, let
Wizards know you are sad the project was killed via Reddit, Twitter, you name it. If you would like to be proactive,
please upvote/like/retween MTGA Tracker announcements at the following places to publicely let Wizards know you support
this project: [This GitHub project (toss us a star!)](https://github.com/shawkinsl/mtga-tracker)
/ [beta forums 1](https://mtgarena.community.gl/forums/threads/14685)
/ [beta forums 2 (TODO: after release post)](#)
/ [Twitter 1 (TODO: after NDA drops)](#)
/ [Twitter 2 (TODO: after first binary release)](#)
/ [reddit 1 (TODO: after NDA drops)](#)
/ [reddit 2(TODO: after first binary release)](#)

In accordance with the [MTG Fan Art policy](http://company.wizards.com/fancontentpolicy): MTGA Tracker is unofficial
Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used
are property of Wizards of the Coast. ©Wizards of the Coast LLC.

### Credits, License

MTGA Tracker is built with many free / oss libraries, in general listed in the various manifest files.
MTGA Tracker is mainly built using [JetBrains' PyCharm](https://www.jetbrains.com/pycharm/), [cmder](http://cmder.net/),
[Electron](https://electronjs.org/), [Python](https://www.python.org/), and many other libraries and tools.

MTGA Tracker is licensed under the [MIT License](https://opensource.org/licenses/MIT).