import json
import os

import math

import datetime
import requests
import time
from six.moves import input
import IPython

import argparse

parser = argparse.ArgumentParser()
parser.add_argument('-p', '--prod', action="store_true")
args = parser.parse_args()

prod_url = "https://wt-bd90f3fae00b1572ed028d0340861e6a-0.run.webtask.io/mtga-tracker-game"
staging_url = "https://wt-bd90f3fae00b1572ed028d0340861e6a-0.run.webtask.io/mtga-tracker-game-staging"

# read secrets
prod_debug_password = None
if os.path.exists("secrets"):
    with open("secrets", "r") as rf:
        for line in rf.readlines():

            key, value = line.strip().split("=")
            if key == "DEBUG_PASSWORD":
                prod_debug_password = value

staging_debug_password = None
if os.path.exists("secrets-staging"):
    with open("secrets-staging", "r") as rf:
        for line in rf.readlines():
            key, value = line.strip().split("=")
            if key == "DEBUG_PASSWORD":
                staging_debug_password = value

if args.prod:
    print("WARNING: you are debugging on the prod server!")
    root_url = prod_url
    debug_password = prod_debug_password
else:
    root_url = staging_url
    debug_password = staging_debug_password


_game_shell = {
    "gameID": 0,
    "winner": "joe",
    "players": [
        {
            "name": "joe",
            "userID": "123-456-789",
            "deck": ["some", "cards"]
        },
        {
            "name": "tess",
            "userID": "123-456-790",
            "deck": ["someother", "cardz"]
        }
    ]
}


def _generate_valid_games():
    players = [
        ("joe", "tess", "joe"),
        ("joe", "tess", "tess"),
        ("tess", "jenny", "jenny"),
        ("joe", "jenny", "jenny",),
        ("jenny", "tess", "tess",),
        ("bob", "joe", "joe",),
        ("bob", "tess", "bob"),
        ("tess", "bob", "tess"),
        ("bob", "jenny", "jenny"),
        ("jenny", "joe", "jenny")]
    for idx, (player1, player2, winner) in enumerate(players):
        new_game = _game_shell.copy()
        new_game["gameID"] = idx
        new_game["players"][0]["name"] = player1
        new_game["players"][1]["name"] = player2
        new_game["winner"] = winner
        print(put_game(new_game))
        time.sleep(1)  # self-rate limit


def get_all_games_page(page, per_page):
    time.sleep(1)
    print(root_url + "/games?page={}&per_page={}&debug_password={}".format(page, per_page, debug_password))
    return requests.get(root_url + "/games?page={}&per_page={}&debug_password={}".format(page, per_page, debug_password)).json()


def get_game_count():
    time.sleep(1)
    print(root_url + "/games/count")
    return requests.get(root_url + "/games/count").json()["game_count"]


def get_games_user(username):
    time.sleep(1)
    return requests.get(root_url + "/games/user/{}?debug_password={}".format(username, debug_password)).json()


def get_games_user_id(user_id):
    time.sleep(1)
    return requests.get(root_url + "/games/userID/{}?debug_password={}".format(user_id, debug_password)).json()


def get_game_by_oid(oid):
    time.sleep(1)
    return requests.get(root_url + "/game/_id/{}?debug_password={}".format(oid, debug_password)).json()


def get_game_by_gid(gid):
    time.sleep(1)
    return requests.get(root_url + "/game/gameID/{}?debug_password={}".format(gid, debug_password)).json()

#
# def debug_reset_all():
#     if not debug_password:
#         return "no debug password loaded, sorry"
#     are_you_sure = input("are you sure? (y/n): ")
#     if "y" in are_you_sure.lower():
#         return requests.post(root_url + "/danger/reset/all", json={"debug_password": debug_password}).json()
#     else:
#         return "ok, backing out"
#


def paranoia_backup():
    game_count = int(get_game_count())
    pages = int(math.ceil((game_count / 100)))
    print("need to get {} pages".format(pages))
    now = datetime.datetime.now()
    logname = now.strftime("paranoia/%m-%d-%Y_%H-%M_backup.json")
    all_docs = []
    for page in range(1, pages + 1):
        new_docs = get_all_games_page(page, 100)["docs"]
        print(new_docs)
        all_docs += new_docs
    os.makedirs('paranoia')
    with open(logname, 'w') as wf:
        json.dump({"all_docs": all_docs}, wf)


def put_game(game=None):
    time.sleep(1)
    if game is None:
        game = _game_shell
    return requests.post(root_url + "/game", json=game).json()

IPython.embed()