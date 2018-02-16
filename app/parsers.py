from app import mtga_watch_app
from models.game import Game, Player
from util import card_ids_to_card_list, id_to_card


def parse_jsonrpc_blob(blob):
    pass


def parse_mulligan_draw(blob):
    """ NOTE: this could be better; look for 'type': 'ZoneType_Hand' for your seatID, get its zomeId, look for
    game objects that end up in that zoneID. This works for now, though."""
    # assume this wasn't called erroneously; dump the curent mulligan
    print("resetting mulligan...")
    with mtga_watch_app.game_lock:
        mtga_watch_app.game.temp["my_mulligan"] = []

    client_msgs = blob['greToClientEvent']['greToClientMessages']
    for message in client_msgs:
        if message['type'] == "GREMessageType_GameStateMessage":
            game_state_message = message['gameStateMessage']
            game_objects = game_state_message["gameObjects"]
            with mtga_watch_app.game_lock:
                for game_object in game_objects:
                    instance_id = game_object["instanceId"]
                    card = id_to_card(game_object["grpId"])
                    mtga_watch_app.game.identified_game_objects[instance_id] = card
                    mtga_watch_app.game.temp["my_mulligan"].append(card)
    print("new mulligan: {}".format(mtga_watch_app.game.temp["my_mulligan"]))


def parse_accept_hand(blob):
    client_message = blob['clientToGreMessage']
    response = client_message['mulliganResp']['decision']
    if response == "MulliganOption_AcceptHand":
        with mtga_watch_app.game_lock:
            mtga_watch_app.game.hero.deck.transfer_cards_to(mtga_watch_app.game.temp["my_mulligan"], mtga_watch_app.game.hero.hand)


def parse_gameroomstatechangedevent(blob):
    temp_players = {
        1: {},
        2: {}
    }
    game_room_info = blob["matchGameRoomStateChangedEvent"]["gameRoomInfo"]
    game_room_players = game_room_info["players"]

    for player in game_room_players:
        temp_players[player["systemSeatId"]]["player_id"] = player["userId"]

    game_room_config = game_room_info["gameRoomConfig"]

    reserved_players = game_room_config["reservedPlayers"]
    for player in reserved_players:
        temp_players[player["systemSeatId"]]["name"] = player["playerName"]

    match_config = game_room_config["matchConfig"]
    teams = match_config["teams"]
    for team in teams:
        players = team["players"]
        for player in players:
            player_seat = player["systemSeatId"]
            temp_players[player_seat]["deck"] = card_ids_to_card_list(player["deckCards"])
    player1 = Player(temp_players[1]["name"], temp_players[1]["player_id"], 1, temp_players[1]["deck"])
    player2 = Player(temp_players[2]["name"], temp_players[2]["player_id"], 2, temp_players[2]["deck"])
    with mtga_watch_app.game_lock:
        mtga_watch_app.game = Game(player2, player1)  # TODO: figure out how to pick the hero


""" simple map: take keys of a dict, and keep digging until you find a callable

# I already realized this won't work, but let's just track stuff here til we have a better solution"""
# log_handler_map = {
#     ["matchGameRoomStateChangedEvent"]: parse_gameroomstatechangedevent,
# }

