import app.parsers as parsers
import app.mtga_app

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
    elif "block_title" in blob and blob["block_title"] == "Event.DeckSubmit":
        parsers.parse_event_decksubmit(blob)
    elif "matchGameRoomStateChangedEvent" in blob:
        dispatch_match_gametoom_state_change(blob)


# MID-LEVER DISPATCHERS: first depth level of a blob
def dispatch_match_gametoom_state_change(blob):
    state_type = blob['matchGameRoomStateChangedEvent']['gameRoomInfo']['stateType']
    if state_type == "MatchGameRoomStateType_Playing":
        parsers.parse_match_playing(blob)
    elif state_type == "MatchGameRoomStateType_MatchCompleted":
        parsers.parse_match_complete(blob)


def dispatch_jsonrpc_method(blob):
    """ route what parser to run on this jsonrpc methoc blob

    :param blob: dict, must contain "method" as top level key
    """
    from app.mtga_app import mtga_watch_app
    dont_care_rpc_methods = ['Event.DeckSelect', "Log.Info", "Deck.GetDeckLists", "Quest.CompletePlayerQuest"]
    current_method = blob['method']
    if current_method in dont_care_rpc_methods:
        pass
    # TODO: deprecated, cleanup
    # elif current_method == "Event.JoinQueue":
    #     intend_to_join = parsers.parse_event_joinqueue(blob)
    #     mtga_watch_app.intend_to_join_game_with = intend_to_join
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
        elif message_type in ["GREMessageType_GameStateMessage", "GREMessageType_QueuedGameStateMessage"]:
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
        app.mtga_app.mtga_logger.info("WARNING: unknown clientToGreMessage type: {}".format(message_type))


# LOWER LEVEL DISPATCHERS: a message or game object (?)
