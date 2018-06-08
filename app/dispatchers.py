import pprint

import app.parsers as parsers
import app.mtga_app
import util

# HIGHEST LEVEL DISPATCHERS: any json blob


@util.debug_log_trace
def dispatch_blob(blob):
    seq = blob.get("block_title_sequence", -1)
    if seq:
        app.mtga_app.mtga_logger.debug("{}dispatching seq ({})".format(util.ld(), seq))
    if "method" in blob and "jsonrpc" in blob:
        dispatch_jsonrpc_method(blob)
    elif "greToClientEvent" in blob:
        dispatch_gre_to_client(blob)
    elif "clientToGreMessage" in blob:
        dispatch_client_to_gre(blob)
    elif "Deck.GetDeckLists" in blob:  # this looks like it's a response to a jsonrpc method
        parsers.parse_get_decklists(blob)
    elif "block_title" in blob and (blob["block_title"] == "Event.DeckSubmit" or \
                                    blob["block_title"] == "Event.GetPlayerCourse"):
        parsers.parse_event_decksubmit(blob)
    elif "matchGameRoomStateChangedEvent" in blob:
        dispatch_match_gametoom_state_change(blob)


# MID-LEVER DISPATCHERS: first depth level of a blob
@util.debug_log_trace
def dispatch_match_gametoom_state_change(blob):
    state_type = blob['matchGameRoomStateChangedEvent']['gameRoomInfo']['stateType']
    if state_type == "MatchGameRoomStateType_Playing":
        parsers.parse_match_playing(blob)
    elif state_type == "MatchGameRoomStateType_MatchCompleted":
        parsers.parse_match_complete(blob)


@util.debug_log_trace
def dispatch_jsonrpc_method(blob):
    """ route what parser to run on this jsonrpc methoc blob

    :param blob: dict, must contain "method" as top level key
    """
    from app.mtga_app import mtga_watch_app
    dont_care_rpc_methods = ['Event.DeckSelect', "Log.Info", "Deck.GetDeckLists", "Quest.CompletePlayerQuest"]
    current_method = blob['method']
    request_or_response = blob['request_or_response']
    if current_method in dont_care_rpc_methods:
        pass
    elif current_method == "PlayerInventory.GetPlayerInventory":
        # TODO: keep an eye on this one. currently empty, but maybe it will show up sometime
        app.mtga_app.mtga_logger.info("{}PlayerInventory.GetPlayerInventory found".format(util.ld()))
    else:
        app.mtga_app.mtga_logger.debug("{}not sure what to do with jsonrpc method {}".format(util.ld(), current_method))


@util.debug_log_trace
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


@util.debug_log_trace
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
        app.mtga_app.mtga_logger.warning("{}WARNING: unknown clientToGreMessage type: {}".format(util.ld(), message_type))


# LOWER LEVEL DISPATCHERS: a message or game object (?)
