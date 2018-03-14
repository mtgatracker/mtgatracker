import requests

root_url = "https://wt-bd90f3fae00b1572ed028d0340861e6a-0.run.webtask.io/mtga-tracker-game"


def get_games():
    return requests.get(root_url + "/games")


valid_game = {
    "gameID": 123,
    "winner": "joe",
    "players": [
        {
            "name": "joe",
            "deck": ["some", "cards"]
        },
        {
            "name": "tess",
            "deck": ["someother", "cardz"]
        }
    ]
}


def get_all_games():
    return requests.get(root_url + "/games")


def get_game_by_oid(oid):
    return requests.get(root_url + "/game/_id/{}".format(oid))


def get_game_by_gid(gid):
    return requests.get(root_url + "/game/gameID/{}".format(gid))


def put_game(game=None):
    if game is None:
        game = valid_game
    return requests.post(root_url + "/game", json=game)