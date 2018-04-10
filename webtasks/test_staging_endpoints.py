import random
import string
import copy
import os
import pytest
import time

import requests

url = "https://wt-bd90f3fae00b1572ed028d0340861e6a-0.run.webtask.io/mtga-tracker-game-staging"
staging_debug_password = None
if os.path.exists("secrets-staging"):
    with open("secrets-staging", "r") as rf:
        for line in rf.readlines():
            key, value = line.strip().split("=")
            if key == "DEBUG_PASSWORD":
                staging_debug_password = value

_game_shell = {
    "gameID": 0,
    "winner": "joe",
    "players": [
        {
            "name": "joe",
            "userID": "123-456-789",
            "deck": {
                "deckID": "123-joe-456",
                "poolName": "joe's deck",
                "cards": {
                    "123": 1,
                    "1234": 3,
                }
            }
        },
        {
            "name": "tess",
            "userID": "123-456-790",
            "deck": {
                "deckID": "123-tess-456",
                "poolName": "tess's deck",
                "cards": {
                    "123": 60,
                    "1234": 3,
                }
            }
        }
    ]
}


def post(post_url, post_json):
    print("POST {} / {}".format(post_url, post_json))
    time.sleep(1.5)
    return requests.post(post_url, json=post_json).json()


def get(get_url, raw_result=False):
    print("GET {}".format(get_url))
    time.sleep(1.5)
    result = requests.get(get_url)
    if raw_result:
        return result
    return result.json()


def _random_string():
    return ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(10))


def post_random_game(winner=None, loser=None, winner_id=None, loser_id=None):
    game = copy.deepcopy(_game_shell)
    game["gameID"] = _random_string()
    if winner:
        game["winner"] = winner
        game["players"][0]["name"] = winner
    if loser:
        game["players"][1]["name"] = loser
    if winner_id:
        game["players"][0]["userID"] = winner_id
    if loser_id:
        game["players"][1]["userID"] = loser_id
    return game, post(url + "/game", post_json=game)


def post_bad_game(missing_winner_name=True, missing_loser_name=False,
                  missing_winning_deck=False, missing_losing_deck=False,
                  missing_winner_user_id=False, missing_loser_user_id=False,
                  no_winner_defined=False, missing_game_id=False,
                  players_undefined=False, players_not_list=False, players_empty=False):
    game = copy.deepcopy(_game_shell)
    if missing_winner_name:
        del game["players"][0]["name"]
    if missing_loser_name:
        del game["players"][1]["name"]
    if missing_winner_user_id:
        del game["players"][0]["userID"]
    if missing_loser_user_id:
        del game["players"][1]["userID"]
    if missing_winning_deck:
        del game["players"][0]["deck"]
    if missing_losing_deck:
        del game["players"][1]["deck"]
    if no_winner_defined:
        del game["winner"]
    if missing_game_id:
        del game["gameID"]
    if players_undefined:
        del game["players"]
    if players_not_list:
        game["players"] = {"not": "list"}
    if players_empty:
        game["players"] = []

    return post(url + "/game", post_json=game)


def get_game_count():
    return get(url + "/games/count")["game_count"]


def get_all_games_page(page, per_page):
    return get(url + "/games?page={}&per_page={}&debug_password={}".format(page, per_page, staging_debug_password))


def get_user_games(user, page=1, per_page=10):
    return get(url + "/games/user/{}?debug_password={}&page={}&per_page={}".format(user, staging_debug_password, page, per_page))


def get_user_id_games(user_id, page=1, per_page=10):
    return get(url + "/games/userID/{}?debug_password={}&page={}&per_page={}".format(user_id, staging_debug_password, page, per_page))


def get_game_by_id(game_id):
    return get(url + "/game/gameID/{}?debug_password={}".format(game_id, staging_debug_password))


def get_game_by_oid(game_oid):
    return get(url + "/game/_id/{}?debug_password={}".format(game_oid, staging_debug_password))


@pytest.fixture
def empty_database():
    post(url + "/danger/reset/all", {"debug_password": staging_debug_password})


@pytest.fixture
def new_entry_base(empty_database):
    for i in range(5):
        post_random_game()


@pytest.fixture
def any_entries_5_or_more():
    games = get(url + "/games/count")["game_count"]
    while games < 5:
        post_random_game()


def test_games_count(new_entry_base):
    game_count = get_game_count()
    _game, _post = post_random_game()
    new_game_count = get_game_count()
    assert new_game_count == game_count + 1


def test_get_all_games(any_entries_5_or_more):
    all_id_set = set()
    up_to_2 = get_all_games_page(1, 2)
    assert len(up_to_2["docs"]) == 2
    [all_id_set.add(i["gameID"]) for i in up_to_2["docs"]]

    up_to_4 = get_all_games_page(2, 2)
    assert len(up_to_4["docs"]) == 2
    assert up_to_2 != up_to_4

    [all_id_set.add(i["gameID"]) for i in up_to_4["docs"]]
    assert len(all_id_set) == 4


def test_get_users_games(any_entries_5_or_more):
    random_user = _random_string()
    user_games = get_user_games(random_user)
    assert(len(user_games["docs"]) == 0)
    post_random_game(random_user)
    post_random_game(random_user)
    user_games = get_user_games(random_user)
    assert len(user_games["docs"]) == 2

    post_random_game(random_user)
    post_random_game(random_user)
    user_games = get_user_games(random_user)
    assert len(user_games["docs"]) == 4
    all_id_set = set()
    up_to_2 = get_user_games(random_user, 1, 2)
    assert len(up_to_2["docs"]) == 2
    [all_id_set.add(i["gameID"]) for i in up_to_2["docs"]]
    up_to_4 = get_user_games(random_user, 2, 2)
    assert len(up_to_4["docs"]) == 2
    assert up_to_2 != up_to_4
    [all_id_set.add(i["gameID"]) for i in up_to_4["docs"]]
    assert len(all_id_set) == 4


def test_get_users_games_by_user_id(any_entries_5_or_more):
    random_user_id = _random_string()
    user_games = get_user_id_games(random_user_id)
    assert(len(user_games["docs"]) == 0)
    post_random_game(winner_id=random_user_id)
    post_random_game(winner_id=random_user_id)
    user_games = get_user_id_games(random_user_id)
    assert len(user_games["docs"]) == 2

    post_random_game(winner_id=random_user_id)
    post_random_game(winner_id=random_user_id)
    user_games = get_user_id_games(random_user_id)
    assert len(user_games["docs"]) == 4

    all_id_set = set()
    up_to_2 = get_user_id_games(random_user_id, 1, 2)
    assert len(up_to_2["docs"]) == 2
    [all_id_set.add(i["gameID"]) for i in up_to_2["docs"]]
    up_to_4 = get_user_id_games(random_user_id, 2, 2)
    assert len(up_to_4["docs"]) == 2
    assert up_to_2 != up_to_4
    [all_id_set.add(i["gameID"]) for i in up_to_4["docs"]]
    assert len(all_id_set) == 4


@pytest.mark.dev
def test_get_game(any_entries_5_or_more):
    game, res = post_random_game()
    game_id = game["gameID"]
    game_by_id = get_game_by_id(game_id)
    game_by_oid = get_game_by_oid(game_by_id["_id"])
    assert game_by_oid == game_by_id


def test_post_game(any_entries_5_or_more):
    game_count = get_game_count()
    post_random_game()
    game_count_after = get_game_count()
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=True)
    game_count_after = get_game_count()
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, missing_loser_name=True)
    game_count_after = get_game_count()
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, missing_winning_deck=True)
    game_count_after = get_game_count()
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, missing_losing_deck=True)
    game_count_after = get_game_count()
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, missing_winner_user_id=True)
    game_count_after = get_game_count()
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, missing_loser_user_id=True)
    game_count_after = get_game_count()
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, no_winner_defined=True)
    game_count_after = get_game_count()
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, missing_game_id=True)
    game_count_after = get_game_count()
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, players_undefined=True)
    game_count_after = get_game_count()
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, players_not_list=True)
    game_count_after = get_game_count()
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, players_empty=True)
    game_count_after = get_game_count()
    assert game_count_after == game_count + 1


def test_404():
    result = get(url + "/its-bananas", True)
    assert result.status_code == 404
    assert "may be banned" in str(result.json())
    result = get(url + "/its/bananas/b-a-n-a-n-a-s", True)
    assert result.status_code == 404
    assert "may be banned" in str(result.json())


if __name__ == "__main__":
    pytest.main()