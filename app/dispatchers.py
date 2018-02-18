import pprint

import app.parsers as parsers


# HIGHEST LEVEL DISPATCHERS: any json blob


def dispatch_blob(blob):
    if "method" in blob and "jsonrpc" in blob:
        dispatch_jsonrpc_method(blob)
    elif "greToClientEvent" in blob:
        dispatch_gre_to_client(blob)
    elif "clientToGreMessage" in blob:
        dispatch_client_to_gre(blob)
    elif "Deck.GetDeckLists" in blob:  # this looks like it's a response to a jsonrpc method
        parsers.parse_get_decklists(blob)
    elif "matchGameRoomStateChangedEvent" in blob:
        parsers.parse_gameroomstatechangedevent(blob)


# MID-LEVER DISPATCHERS: first depth level of a blob
def dispatch_jsonrpc_method(blob):
    """ route what parser to run on this jsonrpc methoc blob

    :param blob: dict, must contain "method" as top level key
    """
    dont_care_rpc_methods = ['Event.DeckSelect', "Log.Info", "Deck.GetDeckLists", "Quest.CompletePlayerQuest"]
    current_method = blob['method']
    if current_method in dont_care_rpc_methods:
        pass
    elif current_method == "Event.JoinQueue":
        parsers.parse_event_joinqueue(blob)
        # TODO mtga_watch_app.logger.debug("got an info block, ignoring")
    elif current_method == "PlayerInventory.GetPlayerInventory":
        # TODO: keep an eye on this one. currently empty, but maybe it will show up sometime
        pass


def dispatch_gre_to_client(blob):
    client_messages = blob["greToClientEvent"]['greToClientMessages']
    dont_care_types = ["GREMessageType_UIMessage"]
    for message in client_messages:
        message_type = message["type"]
        if message_type in dont_care_types:
            pass
        elif message_type == "GREMessageType_GameStateMessage":
            game_state_message = message['gameStateMessage']
            parsers.parse_game_state_message(game_state_message)


def dispatch_client_to_gre(blob):
    client_message = blob['clientToGreMessage']
    message_type = client_message['type']
    dont_care_types = ["ClientMessageType_UIMessage"]
    unknown_types = ["ClientMessageType_PerformActionResp", "ClientMessageType_DeclareAttackersResp"
                     "ClientMessageType_DeclareBlockersResp", "ClientMessageType_SetSettingsReq",
                     "ClientMessageType_SelectNResp", "ClientMessageType_SelectTargetsResp",
                     "ClientMessageType_SubmitTargetsReq", "ClientMessageType_SubmitAttackersReq",
                     "ClientMessageType_ConnectReq"]
    if message_type in dont_care_types:
        pass
    elif message_type == "ClientMessageType_MulliganResp":
        parsers.parse_mulligan_response(client_message)
    elif message_type in unknown_types:
        # TODO: log ?
        pass
    else:
        print("WARNING: unknown clientToGreMessage type: {}".format(message_type))


# LOWER LEVEL DISPATCHERS: a message or game object (?)
