import os
import requests
import time
from six.moves import input

root_url = "https://wt-bd90f3fae00b1572ed028d0340861e6a-0.run.webtask.io/mtga-tracker-game"

# read secrets
debug_password = None
if os.path.exists("secrets"):
    with open("secrets", "r") as rf:
        for line in rf.readlines():

            key, value = line.strip().split("=")
            if key == "DEBUG_PASSWORD":
                debug_password = value


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


def get_all_games():
    return requests.get(root_url + "/games").json()


def get_games_user(username):
    return requests.get(root_url + "/games/user/{}".format(username)).json()


def get_games_user_id(user_id):
    return requests.get(root_url + "/games/userID/{}".format(user_id)).json()


def get_game_by_oid(oid):
    return requests.get(root_url + "/game/_id/{}".format(oid)).json()


def get_game_by_gid(gid):
    return requests.get(root_url + "/game/gameID/{}".format(gid)).json()


def debug_reset_all():
    if not debug_password:
        return "no debug password loaded, sorry"
    are_you_sure = input("are you sure? (y/n): ")
    if "y" in are_you_sure.lower():
        return requests.post(root_url + "/danger/reset/all", json={"debug_password": debug_password}).json()
    else:
        return "ok, backing out"


def put_game(game=None):
    if game is None:
        game = _game_shell
    return requests.post(root_url + "/game", json=game).json()