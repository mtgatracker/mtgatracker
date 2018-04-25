import random
import string
import copy
import os

import datetime
import pytest
import pymongo
import time
import requests
import sys
import jwt

url = "https://wt-bd90f3fae00b1572ed028d0340861e6a-0.run.webtask.io/mtga-tracker-game-staging"
delay = 1.5
staging_mongo_url = os.getenv("MONGO_URL")
if "--local" in sys.argv:
    url = "http://localhost:8080"
    delay = 0
if os.path.exists("secrets-staging"):
    with open("secrets-staging", "r") as rf:
        for line in rf.readlines():
            key, value = line.strip().split("=")
            if key == "MONGO_URL" and not staging_mongo_url:
                staging_mongo_url = value


mongo_client = pymongo.MongoClient(staging_mongo_url)
database = mongo_client['mtga-tracker-staging']
games_collection = database['game']
users_collection = database['user']


def post(post_url, post_json, raw_result=False, headers=None):
    post_json_str = str(post_json)
    if len(post_json_str) > 30:
        print("POST {} / {}".format(post_url, post_json_str[:30] + "..."))
    else:
        print("POST {} / {}".format(post_url, post_json))
    time.sleep(delay)
    result = requests.post(post_url, json=post_json, headers=headers)
    if raw_result:
        return result
    return result.json()


def get(get_url, raw_result=False, headers=None):
    print("GET {}".format(get_url))
    time.sleep(delay)
    result = requests.get(get_url, headers=headers)
    if raw_result:
        return result
    print(result)
    print(result.text)
    return result.json()


def delete(delete_url, raw_result=False, headers=None):
    print("DELETE {}".format(delete_url))
    time.sleep(delay)
    result = requests.delete(delete_url, headers=headers)
    if raw_result:
        return result
    return result.json()


_game_shell_schema_0 = {
    "schemaver": 0,  # this will not be present on actual records
    "gameID": 0,
    "winner": "joe",
    "players": [
        {
            "name": "joe",
            "userID": "123-456-789",
            "deck": {
                "deckID": "123-joe-456",
                "poolName": "Joe The Hero's Deck",
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
                "poolName": "tess's visible cards",
                "cards": {
                    "123": 60,
                    "1234": 3,
                }
            }
        }
    ]
}
res = get("https://wt-bd90f3fae00b1572ed028d0340861e6a-0.run.webtask.io/mtga-tracker-game/gh-stat-cache")
latest_client_version = res.get("latestVersionString", "1.1.1-beta")

_game_shell_schema_1_1_0_beta = copy.deepcopy(_game_shell_schema_0)
_game_shell_schema_1_1_0_beta["hero"] = "joe"
_game_shell_schema_1_1_0_beta["client_version"] = latest_client_version

_game_shell_schema_1_1_1_beta = copy.deepcopy(_game_shell_schema_1_1_0_beta)
_game_shell_schema_1_1_1_beta['opponent'] = "tess"


def _random_string():
    return ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(10))


def _post_games(games, admin_token, no_verify=False):
    post_url = url + "/admin-api/games"
    if no_verify:
        post_url += "/no-verify"
    return games, post(post_url, post_json={"games": games}, headers={"token": admin_token})


def post_random_games(games=None, num_games=None, admin_token=None, no_verify=False, game_shell=_game_shell_schema_1_1_0_beta):
    if games is None:
        games = [copy.deepcopy(game_shell) for _ in range(num_games or 3)]
        for game in games:
            game["gameID"] = _random_string()
    return _post_games(games, admin_token, no_verify)


def _post_game(game, no_verify=False, token=None, use_public_api=False):
    if token is None:
        token = get_anon_token()
    if use_public_api:
        post_url = url + "/game"
    else:
        post_url = url + "/anon-api/game"
    if no_verify:
        post_url += "/no-verify"
    return game, post(post_url, post_json=game, headers={"token": token})


def get_anon_token():
    return get(url + "/public-api/anon-api-token")["token"]


def get_user_token(username):
    request_auth(username)
    user_after_auth_request = users_collection.find_one({"username": username})
    assert "auth" in user_after_auth_request.keys()
    access_code = int(user_after_auth_request["auth"]["accessCode"])
    return post(url + "/public-api/auth-attempt", post_json={"username": username, "accessCode": access_code})["token"]


def post_random_game(winner=None, loser=None, winner_id=None, loser_id=None, client_version=None, no_verify=False,
                     game_shell=_game_shell_schema_1_1_0_beta, token=None):
    if token is None:
        token = get_anon_token()
    game = copy.deepcopy(game_shell)
    game["gameID"] = _random_string()
    if winner:
        game["winner"] = winner
        game["players"][0]["name"] = winner
        game["players"][0]["deck"]["poolName"] = "{} The Hero's Deck".format(winner)
    if loser:
        game["players"][1]["name"] = loser
        game["players"][1]["deck"]["poolName"] = "{}'s visible cards".format(loser)
    if winner_id:
        game["players"][0]["userID"] = winner_id
    if loser_id:
        game["players"][1]["userID"] = loser_id
    if client_version:
        game["client_version"] = client_version
    return _post_game(game, no_verify, token=token)


def post_bad_game(missing_winner_name=False, missing_loser_name=False,
                  missing_winning_deck=False, missing_losing_deck=False,
                  missing_winner_user_id=False, missing_loser_user_id=False,
                  no_winner_defined=False, missing_game_id=False,
                  players_undefined=False, players_not_list=False, players_empty=False,
                  no_verify=False):
    game = copy.deepcopy(_game_shell_schema_0)
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

    return _post_game(game, no_verify)


def insert_taken_user(username=None, public_name=None, is_user=False):
    if username is None:
        username = _random_string()
    if public_name is None:
        public_name = _random_string()
    users_collection.insert_one({"username": username, "available": False, "publicName": public_name,
                                 "isUser": is_user})


def request_auth(username, silent=True):
    return post(url + "/public-api/auth-request", post_json={"silent": silent, "username": username}, raw_result=True).json()


def insert_available_user(public_name=None):
    if public_name is None:
        public_name = _random_string()
    users_collection.insert_one({"publicName": public_name, "available": True})


def get_game_count(token=None):
    if token is None:
        token = get_anon_token()
    return get(url + "/anon-api/games/count", headers={"token": token})["game_count"]


def get_client_versions(admin_token):
    return get(url + "/admin-api/users/client_versions", headers={"token": admin_token})


def get_user_count(token=None):
    if token is None:
        token = get_anon_token()
    return get(url + "/anon-api/users/count", headers={"token": token})["unique_user_count"]


def get_all_games_admin_page(admin_token, page, per_page):
    all_games_url = url + "/admin-api/games?page={}&per_page={}".format(page, per_page)
    return get(all_games_url, headers={"token": admin_token})


def get_user_games_admin(user, admin_token, page=1, per_page=10):
    admin_games_url = url + "/admin-api/games/user/{}?page={}&per_page={}".format(user, page, per_page)
    return get(admin_games_url, headers={"token": admin_token})


def get_user_id_games(user_id, admin_token, page=1, per_page=10):
    admin_games_url = url + "/admin-api/games/userID/{}?page={}&per_page={}".format(user_id, page, per_page)
    return get(admin_games_url, headers={"token": admin_token})


def get_game_by_id(game_id, token, raw_result=False):
    game_id_url = url + "/api/game/gameID/{}".format(game_id)
    return get(game_id_url, headers={"token": token}, raw_result=raw_result)


def get_game_by_oid(game_oid, token, raw_result=False):
    oid_url = url + "/api/game/_id/{}".format(game_oid)
    return get(oid_url, headers={"token": token}, raw_result=raw_result)


@pytest.fixture
def empty_game_collection():
    games_collection.drop()


@pytest.fixture
def empty_user_collection():
    users_collection.drop()

@pytest.fixture
def admin_token():
    insert_taken_user("Spencatro", "Tracker_Admin")
    return get_user_token("Spencatro")


@pytest.fixture
def new_entry_base(empty_game_collection, admin_token):
    post_random_games(num_games=5, admin_token=admin_token)


@pytest.fixture
def any_games_5_or_more(admin_token):
    anon_key = get_anon_token()
    games = get_game_count(anon_key)
    if games < 5:
        post_random_games(num_games=5, admin_token=admin_token)


def test_games_count(new_entry_base):
    anon_token = get_anon_token()
    game_count = get_game_count(anon_token)
    _game, _post = post_random_game(token=anon_token)
    new_game_count = get_game_count(anon_token)
    assert new_game_count == game_count + 1


def test_user_client_versions(empty_game_collection, admin_token):
    clients = get_client_versions(admin_token)
    assert not clients['counts']
    _game, _post = post_random_game(game_shell=_game_shell_schema_0)
    clients = get_client_versions(admin_token)
    assert clients['counts'] == {"none": 1}
    _game, _post = post_random_game(client_version="1.1.0-beta")
    clients = get_client_versions(admin_token)
    assert clients['counts'] == {"none": 1, "1.1.0-beta": 1}
    _game, _post = post_random_game(client_version="1.1.0-beta")
    clients = get_client_versions(admin_token)
    assert clients['counts'] == {"none": 1, "1.1.0-beta": 2}
    _game, _post = post_random_game(client_version="1.2.0-beta")
    clients = get_client_versions(admin_token)
    assert clients['counts'] == {"none": 1, "1.1.0-beta": 2, "1.2.0-beta": 1}

def test_unique_users_count(empty_game_collection):
    original_user_count = get_user_count()
    assert original_user_count == 0
    _game, _post = post_random_game()
    after_posting_one_game_user_count = get_user_count()
    assert after_posting_one_game_user_count == 1
    _game, _post = post_random_game(loser='jenna')
    after_posting_game_with_same_users_user_count = get_user_count()
    assert after_posting_game_with_same_users_user_count == 1
    _game, _post = post_random_game(winner="gemma", loser='jenna')
    after_posting_game_with_new_users_user_count = get_user_count()
    assert after_posting_game_with_new_users_user_count == 2


def test_get_all_games(any_games_5_or_more, admin_token):
    all_id_set = set()
    up_to_2 = get_all_games_admin_page(admin_token, 1, 2)
    assert len(up_to_2["docs"]) == 2
    [all_id_set.add(i["gameID"]) for i in up_to_2["docs"]]

    up_to_4 = get_all_games_admin_page(admin_token, 2, 2)
    assert len(up_to_4["docs"]) == 2
    assert up_to_2 != up_to_4

    [all_id_set.add(i["gameID"]) for i in up_to_4["docs"]]
    assert len(all_id_set) == 4


def test_get_users_games_admin(any_games_5_or_more, admin_token):
    random_user = _random_string()
    user_games = get_user_games_admin(random_user, admin_token)
    assert(len(user_games["docs"]) == 0)
    post_random_game(random_user)
    post_random_game(random_user)
    user_games = get_user_games_admin(random_user, admin_token)
    assert len(user_games["docs"]) == 2

    post_random_game(random_user)
    post_random_game(random_user)
    user_games = get_user_games_admin(random_user, admin_token)
    assert len(user_games["docs"]) == 4
    all_id_set = set()
    up_to_2 = get_user_games_admin(random_user, admin_token, 1, 2)
    assert len(up_to_2["docs"]) == 2
    [all_id_set.add(i["gameID"]) for i in up_to_2["docs"]]
    up_to_4 = get_user_games_admin(random_user, admin_token, 2, 2)
    assert len(up_to_4["docs"]) == 2
    assert up_to_2 != up_to_4
    [all_id_set.add(i["gameID"]) for i in up_to_4["docs"]]
    assert len(all_id_set) == 4


def test_get_users_games_by_user_id_admin(any_games_5_or_more, admin_token):
    random_user_id = _random_string()
    user_games = get_user_id_games(random_user_id, admin_token)
    assert(len(user_games["docs"]) == 0)
    post_random_game(winner_id=random_user_id)
    post_random_game(winner_id=random_user_id)
    user_games = get_user_id_games(random_user_id, admin_token)
    assert len(user_games["docs"]) == 2

    post_random_game(winner_id=random_user_id)
    post_random_game(winner_id=random_user_id)
    user_games = get_user_id_games(random_user_id, admin_token)
    assert len(user_games["docs"]) == 4

    all_id_set = set()
    up_to_2 = get_user_id_games(random_user_id, admin_token, 1, 2)
    assert len(up_to_2["docs"]) == 2
    [all_id_set.add(i["gameID"]) for i in up_to_2["docs"]]
    up_to_4 = get_user_id_games(random_user_id, admin_token, 2, 2)
    assert len(up_to_4["docs"]) == 2
    assert up_to_2 != up_to_4
    [all_id_set.add(i["gameID"]) for i in up_to_4["docs"]]
    assert len(all_id_set) == 4


def test_get_game(any_games_5_or_more):
    game, res = post_random_game(winner="tess", loser="joey")
    game_id = game["gameID"]
    hero_token = get_user_token("tess")
    opponent_token = get_user_token("joey")
    game_by_id_from_hero = get_game_by_id(game_id, hero_token)
    game_by_id_from_oppo = get_game_by_id(game_id, opponent_token, raw_result=True)
    assert game_by_id_from_oppo.status_code == 401
    game_by_oid_from_hero = get_game_by_oid(game_by_id_from_hero["_id"], hero_token)
    game_by_oid_from_oppo = get_game_by_oid(game_by_id_from_hero["_id"], opponent_token, raw_result=True)
    assert game_by_oid_from_oppo.status_code == 401
    assert game_by_oid_from_hero == game_by_id_from_hero


def test_post_game(any_games_5_or_more):
    anon_token = get_anon_token()
    game_count = get_game_count(token=anon_token)
    post_random_game(token=anon_token)
    game_count_after = get_game_count(anon_token)
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=True)
    game_count_after = get_game_count(anon_token)
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, missing_loser_name=True)
    game_count_after = get_game_count(anon_token)
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, missing_winning_deck=True)
    game_count_after = get_game_count(anon_token)
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, missing_losing_deck=True)
    game_count_after = get_game_count(anon_token)
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, missing_winner_user_id=True)
    game_count_after = get_game_count(anon_token)
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, missing_loser_user_id=True)
    game_count_after = get_game_count(anon_token)
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, no_winner_defined=True)
    game_count_after = get_game_count(anon_token)
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, missing_game_id=True)
    game_count_after = get_game_count(anon_token)
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, players_undefined=True)
    game_count_after = get_game_count(anon_token)
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, players_not_list=True)
    game_count_after = get_game_count(anon_token)
    assert game_count_after == game_count + 1
    post_bad_game(missing_winner_name=False, players_empty=True)
    game_count_after = get_game_count(anon_token)
    assert game_count_after == game_count + 1


def test_post_game_without_hero_gets_hero():
    posted_game, result = post_random_game(game_shell=_game_shell_schema_0)
    assert "hero" not in posted_game.keys()
    game_id = posted_game["gameID"]
    hero_token = get_user_token("joe")
    game_by_id = get_game_by_id(game_id, hero_token)
    assert "hero" in game_by_id.keys()
    for player in game_by_id["players"]:
        if player["name"] == game_by_id["hero"]:
            assert "visible cards" not in player["deck"]["poolName"]
        else:
            assert "visible cards" in player["deck"]["poolName"]


def test_clientversion_ok(any_games_5_or_more):
    posted_game, result = post_random_game(game_shell=_game_shell_schema_1_1_0_beta)
    assert "clientVersionOK" not in posted_game.keys()
    game_id = posted_game["gameID"]
    hero_token = get_user_token(posted_game["hero"])
    game_by_id = get_game_by_id(game_id, hero_token)
    assert "clientVersionOK" in game_by_id.keys() and game_by_id["clientVersionOK"]

    posted_game, result = post_random_game(client_version="0.0.0-alpha", game_shell=_game_shell_schema_1_1_0_beta)
    assert "clientVersionOK" not in posted_game.keys()
    game_id = posted_game["gameID"]
    hero_token = get_user_token(posted_game["hero"])
    game_by_id = get_game_by_id(game_id, hero_token)
    assert "clientVersionOK" in game_by_id.keys() and not game_by_id["clientVersionOK"]

    posted_game, result = post_random_game(client_version="99.99.99", game_shell=_game_shell_schema_1_1_0_beta)
    assert "clientVersionOK" not in posted_game.keys()
    game_id = posted_game["gameID"]
    hero_token = get_user_token(posted_game["hero"])
    game_by_id = get_game_by_id(game_id, hero_token)
    assert "clientVersionOK" in game_by_id.keys() and not game_by_id["clientVersionOK"]

    posted_game, result = post_random_game(client_version=None, game_shell=_game_shell_schema_0)
    assert "clientVersionOK" not in posted_game.keys() and "client_version" not in posted_game.keys()
    game_id = posted_game["gameID"]
    hero_token = get_user_token("joe")
    game_by_id = get_game_by_id(game_id, hero_token)
    assert "clientVersionOK" in game_by_id.keys() and not game_by_id["clientVersionOK"]


@pytest.mark.slow
def test_gh_cache(admin_token):
    token = get_anon_token()
    stat_cache = get(url + "/anon-api/gh-stat-cache", headers={"token": token})
    time.sleep(1)
    stat_cache_immediate = get(url + "/anon-api/gh-stat-cache", headers={"token": token})
    assert stat_cache_immediate["lastUpdated"] == stat_cache["lastUpdated"]
    time.sleep(1)
    delete(url + "/admin-api/gh-stat-cache", headers={"token": admin_token})
    time.sleep(1)
    stat_cache_after_delete = get(url + "/anon-api/gh-stat-cache", headers={"token": token})
    assert stat_cache_after_delete["lastUpdated"] != stat_cache_immediate["lastUpdated"]
    time.sleep(120)
    stat_cache_after_wait = get(url + "/anon-api/gh-stat-cache", headers={"token": token})
    assert stat_cache_after_wait["lastUpdated"] != stat_cache_after_delete["lastUpdated"]


def test_post_games(any_games_5_or_more, admin_token):
    game_count = get_game_count(admin_token)
    post_random_games(admin_token=admin_token)
    time.sleep(1)
    game_count_after = get_game_count(admin_token)
    assert game_count_after == game_count + 3


def test_post_tons_of_new_games(any_games_5_or_more, admin_token):
    game_count = get_game_count(admin_token)
    two_hundred_random_games = [copy.deepcopy(_game_shell_schema_0) for _ in range(200)]
    for game in two_hundred_random_games:
        game["gameID"] = _random_string()
    post_random_games(two_hundred_random_games, admin_token=admin_token)
    time.sleep(0.5)  # give a hair of recovery time
    game_count_after_200 = get_game_count(admin_token)
    assert game_count_after_200 == game_count + 200


def test_post_games_with_duplicate_ids(any_games_5_or_more, admin_token):
    game_count = get_game_count()
    six_games_five_duplicates = [copy.deepcopy(_game_shell_schema_0) for _ in range(6)]
    same_string = _random_string()
    for game in six_games_five_duplicates:
        game["gameID"] = same_string
    six_games_five_duplicates[0]["gameID"] = _random_string()
    post_random_games(six_games_five_duplicates, admin_token=admin_token)
    game_count_after_2 = get_game_count()
    assert game_count_after_2 == game_count + 2

    game_count = game_count_after_2
    post_random_games(six_games_five_duplicates, admin_token=admin_token)
    game_count_after_posting_all_duplicates = get_game_count()
    assert game_count_after_posting_all_duplicates == game_count


def test_get_publicname(empty_game_collection, empty_user_collection, admin_token):
    username = "bobby"
    pubname = "Frilled_Merfolk"
    res_before_insert = get(url + "/admin-api/publicName/{}".format(username), raw_result=True, headers={"token": admin_token})
    assert res_before_insert.status_code == 404
    insert_taken_user(username, pubname)
    res_after = get(url + "/admin-api/publicName/{}".format(username), headers={"token": admin_token})
    assert res_after["username"] == username
    assert res_after["publicName"] == pubname


def test_publicname_chosen_if_available(empty_game_collection, empty_user_collection, admin_token):
    insert_available_user("testpubname1")
    insert_available_user("testpubname2")

    game, _ = post_random_game()
    public_name_url = url + "/admin-api/publicName/{}".format(game["players"][0]["name"])
    user1_back = get(public_name_url, headers={"token": admin_token})
    assert user1_back['publicName'] in ["testpubname1", "testpubname2"]
    assert user1_back['available'] is False

    public_name_url = url + "/admin-api/publicName/{}".format(game["players"][1]["name"])
    user2_back = get(public_name_url, headers={"token": admin_token})
    assert user2_back['publicName'] in ["testpubname1", "testpubname2"]
    assert user2_back['available'] is False

    assert user1_back['publicName'] != user2_back['publicName']


def test_publicname_generated_if_none_available(empty_game_collection, empty_user_collection, admin_token):
    game, _ = post_random_game()
    public_name_url = url + "/admin-api/publicName/{}".format(game["players"][0]["name"])
    user1_back = get(public_name_url, headers={"token": admin_token})
    assert user1_back['publicName']
    assert user1_back['available'] is False

    public_name_url = url + "/admin-api/publicName/{}".format(game["players"][1]["name"])
    user2_back = get(public_name_url, headers={"token": admin_token})
    assert user2_back['publicName']
    assert user2_back['available'] is False

    assert user1_back['publicName'] != user2_back['publicName']


def test_users_dont_get_overwritten_when_opponents(empty_game_collection, empty_user_collection, admin_token):
    game, _ = post_random_game(winner="trish", loser="james")  # trish is the user, james is not
    game, _ = post_random_game(winner="kate", loser="james")  # kate is the user, james is not
    game, _ = post_random_game(winner="joey", loser="trish")  # kate is the user, james is not

    trish_url = url + "/admin-api/publicName/{}".format("trish")
    trish_back = get(trish_url, headers={"token": admin_token})
    assert trish_back['isUser']

    joey_url = url + "/admin-api/publicName/{}".format("joey")
    joey_back = get(joey_url,  headers={"token": admin_token})
    assert joey_back['isUser']


def test_users_update_if_theyre_heroes_now_but_theyve_been_opponents_before(empty_game_collection, empty_user_collection, admin_token):
    game, _ = post_random_game(winner="trish", loser="james")  # trish is the user, james is not
    game, _ = post_random_game(winner="kate", loser="james")  # kate is the user, james is not
    game, _ = post_random_game(winner="james", loser="trish")  # kate is the user, james is not

    trish_url = url + "/admin-api/publicName/{}".format("trish")
    trish_back = get(trish_url, headers={"token": admin_token})
    assert trish_back['isUser']

    kate_url = url + "/admin-api/publicName/{}".format("kate")
    kate_back = get(kate_url, headers={"token": admin_token})
    assert kate_back['isUser']

    james_url = url + "/admin-api/publicName/{}".format("james")
    james_back = get(james_url, headers={"token": admin_token})
    assert james_back['isUser']


def test_users_are_resilient(empty_game_collection, empty_user_collection, admin_token):
    game, _ = post_random_game(winner="trish", loser="james")  # trish is the user, james is not
    og_trish_public_name = get(url + "/admin-api/publicName/{}".format("trish"), headers={"token": admin_token})
    og_james_public_name = get(url + "/admin-api/publicName/{}".format("james"), headers={"token": admin_token})

    game, _ = post_random_game(winner="kate", loser="james")
    game, _ = post_random_game(winner="james", loser="joey")
    game, _ = post_random_game(winner="james", loser="joey")
    game, _ = post_random_game(winner="james", loser="kate")
    game, _ = post_random_game(winner="james", loser="trish")
    game, _ = post_random_game(winner="trish", loser="james")

    trish_back = get(url + "/admin-api/publicName/{}".format("trish"), headers={"token": admin_token})
    assert trish_back == og_trish_public_name

    james_back = get(url + "/admin-api/publicName/{}".format("james"), headers={"token": admin_token})
    assert james_back["isUser"]
    assert not og_james_public_name["isUser"]
    del og_james_public_name["isUser"]
    del james_back["isUser"]  # these will be different at end, deleted them for easier comparison
    assert james_back == og_james_public_name


def test_duplicate_games_dont_make_duplicate_users(empty_game_collection, empty_user_collection):
    game, _ = post_random_game(winner="kate", loser="james")
    game, _ = post_random_game(winner="james", loser="kate")
    game, _ = post_random_game(winner="kate", loser="james")
    game, _ = post_random_game(winner="james", loser="kate")
    game, _ = post_random_game(winner="kate", loser="james")
    game, _ = post_random_game(winner="james", loser="kate")
    game, _ = post_random_game(winner="kate", loser="james")
    game, _ = post_random_game(winner="james", loser="kate")
    game, _ = post_random_game(winner="james", loser="trish")
    game, _ = post_random_game(winner="trish", loser="james")
    game, _ = post_random_game(winner="trish", loser="kate")
    game, _ = post_random_game(winner="kate", loser="trish")
    assert users_collection.count() == 3


def test_404():
    result = get(url + "/its-bananas", True)
    assert result.status_code == 404
    assert "may be banned" in str(result.json())
    result = get(url + "/its/bananas/b-a-n-a-n-a-s", True)
    assert result.status_code == 404
    assert "may be banned" in str(result.json())


def test_auth_request(empty_game_collection, empty_user_collection):
    game, _ = post_random_game(winner="kate", loser="james")
    kate_before = users_collection.find_one({"username": "kate"})
    assert "auth" not in kate_before.keys()

    request_auth("kate")
    kate_after = users_collection.find_one({"username": "kate"})
    assert "auth" in kate_after.keys()

    access_code = int(kate_after["auth"]["accessCode"])
    assert 0 < access_code < 999999


def test_auth_request_expires(empty_game_collection, empty_user_collection):
    # TODO: dry here and test_auth_request
    game, _ = post_random_game(winner="kate", loser="james")
    kate_before = users_collection.find_one({"username": "kate"})
    assert "auth" not in kate_before.keys()

    request_auth("kate")
    kate_after = users_collection.find_one({"username": "kate"})
    assert "auth" in kate_after.keys()

    access_code = int(kate_after["auth"]["accessCode"])
    assert 0 < access_code < 999999

    request_auth("kate")
    kate_after_2 = users_collection.find_one({"username": "kate"})
    access_code_after = int(kate_after_2["auth"]["accessCode"])
    assert access_code == access_code_after

    expires = kate_after_2["auth"]["expires"]
    expires -= datetime.timedelta(hours=4, minutes=50)  # token has 1:10 left to live
    users_collection.update_one({"username": "kate"}, {"$set": {"auth.expires": expires}})

    kate_after_3 = users_collection.find_one({"username": "kate"})
    access_code_after_3 = int(kate_after_3["auth"]["accessCode"])
    assert access_code_after_3 == access_code_after

    expires = kate_after_3["auth"]["expires"]
    expires -= datetime.timedelta(hours=5, minutes=10)  # token is expired
    users_collection.update_one({"username": "kate"}, {"$set": {"auth.expires": expires}})

    request_auth("kate")
    kate_after_4 = users_collection.find_one({"username": "kate"})
    access_code_after_4 = int(kate_after_4["auth"]["accessCode"])
    assert 0 < access_code_after_4 < 999999
    assert access_code_after_4 != access_code_after_3


@pytest.mark.cron
@pytest.mark.slow
def test_cron_fixes_hero_in_schema0(empty_game_collection, admin_token):
    post_random_games(num_games=20, no_verify=True, game_shell=_game_shell_schema_0)  # need this to exclude hero
    all_games = get_all_games_admin_page(admin_token, 1, 20)
    for game in all_games["docs"]:
        print(game)
        assert "hero" not in game.keys(), game.keys()
    time.sleep(120)
    game_current_first = get_game_by_id(all_games["docs"][0]["gameID"])
    assert "hero" in game_current_first.keys()
    game_current_last = get_game_by_id(all_games["docs"][-1]["gameID"])
    assert "hero" in game_current_last.keys()


@pytest.mark.cron
@pytest.mark.slow
def test_cron_fixes_opponent_in_schema0(empty_game_collection, admin_token):
    post_random_games(num_games=20, no_verify=True, game_shell=_game_shell_schema_1_1_0_beta)
    all_games = get_all_games_admin_page(admin_token, 1, 20)
    for game in all_games["docs"]:
        print(game)
        assert "opponent" not in game.keys(), game.keys()
    time.sleep(120)
    game_current_first = get_game_by_id(all_games["docs"][0]["gameID"])
    assert "opponent" in game_current_first.keys()
    game_current_last = get_game_by_id(all_games["docs"][-1]["gameID"])
    assert "opponent" in game_current_last.keys()


def test_anon_api_not_accessible_without_token():
    anon_api_no_token = get(url + "/anon-api/", raw_result=True)
    assert anon_api_no_token.status_code == 401


def test_admin_api_not_accessible_without_token():
    anon_api_no_token = get(url + "/admin-api/", raw_result=True)
    assert anon_api_no_token.status_code == 401


def test_user_api_not_accessible_without_token():
    anon_api_no_token = get(url + "/api/", raw_result=True)
    assert anon_api_no_token.status_code == 401


def test_get_anon_token(empty_game_collection):
    anon_token = get_anon_token()
    token_decoded = jwt.decode(anon_token, verify=False)  # we don't have the secret, can only inspect the payload
    assert token_decoded["user"] is None
    assert 0 < token_decoded["anonymousClientID"] <= 999999
    plus_48h = datetime.datetime.now() + datetime.timedelta(hours=48)
    token_exp = datetime.datetime.fromtimestamp(token_decoded["exp"])
    assert token_exp < plus_48h
    anon_api_token = get(url + "/anon-api/", headers={"token": anon_token}, raw_result=True)
    assert anon_api_token.status_code == 200


def test_get_user_token(empty_game_collection, empty_user_collection):
    game, _ = post_random_game(winner="kate", loser="james")
    user_token = get_user_token("kate")
    token_decoded = jwt.decode(user_token, verify=False)  # we don't have the secret, can only inspect the payload
    assert token_decoded["user"] == "kate"
    plus_192h = datetime.datetime.now() + datetime.timedelta(hours=192)  # 8 days
    token_exp = datetime.datetime.fromtimestamp(token_decoded["exp"])
    assert token_exp < plus_192h
    anon_api_token = get(url + "/api/", headers={"token": user_token}, raw_result=True)
    assert anon_api_token.status_code == 200


def test_get_user_games(empty_game_collection):
    post_random_game(winner="gemma")
    gemma_token = get_user_token("gemma")
    games = get(url + "/api/games/user", headers={"token": gemma_token})
    print(games)
    for game in games["docs"]:
        print(game)
        assert game["hero"] == "gemma"

    post_random_game(winner="gemma")
    post_random_game(winner="gemma")
    post_random_game(winner="jane")
    post_random_game(winner="gemma")
    post_random_game(winner="jane")
    post_random_game(winner="gemma")

    games = get(url + "/api/games/user", headers={"token": gemma_token})
    print(games)
    for game in games["docs"]:
        print(game)
        assert game["hero"] == "gemma"


if __name__ == "__main__":
    sys.exit(pytest.main(['--html', 'pytest_report.html'] + sys.argv[1:]))
