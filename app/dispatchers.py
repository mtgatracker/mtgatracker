import app.parsers as parsers
import app.mtga_app
import util

# HIGHEST LEVEL DISPATCHERS: any json blob


@util.debug_log_trace
def dispatch_blob(blob):
    seq = blob.get("block_title_sequence", -1)
    log_line = blob.get("log_line", -1)
    if seq:
        app.mtga_app.mtga_logger.debug("{}dispatching seq ({}) / log_line {}".format(util.ld(), seq, log_line))
    if "method" in blob and "jsonrpc" in blob:
        dispatch_jsonrpc_method(blob)
    elif "greToClientEvent" in blob:
        dispatch_gre_to_client(blob)
    elif "clientToGreMessage" in blob:
        dispatch_client_to_gre(blob)
    elif "Deck.GetDeckLists" in blob:  # this looks like it's a response to a jsonrpc method
        parsers.parse_get_decklists(blob)
    elif "block_title" in blob and (blob["block_title"] == "Event.DeckSubmit" or
                                    blob["block_title"] == "Event.GetPlayerCourse"):
        parsers.parse_event_decksubmit(blob)
    elif "block_title" in blob and blob["block_title"] == "PlayerInventory.GetPlayerCardsV3":
        parsers.parse_get_player_cards_v3(blob)
    elif "block_title" in blob and (blob["block_title"] == "Draft.DraftStatus" or
                                    blob["block_title"] == "Draft.MakePick"):
        parsers.parse_draft_status(blob)
    # PlayerInventory.GetPlayerInventory
    elif "block_title" in blob and blob["block_title"] == "PlayerInventory.GetPlayerInventory":
        parsers.pass_through("inventory", blob["playerId"], blob)
    elif "block_title" in blob and blob["block_title"] == "Rank.Updated":
        parsers.pass_through("rank_change", blob["playerId"], blob)
    elif "block_title" in blob and blob["block_title"] == "Inventory.Updated":
        parsers.pass_through("inventory_update", None, blob)
    elif "matchGameRoomStateChangedEvent" in blob:
        dispatch_match_gametoom_state_change(blob)
    elif "block_title" in blob and blob["block_title"] == "Event.MatchCreated":
        parsers.parse_match_created(blob)


# MID-LEVER DISPATCHERS: first depth level of a blob
@util.debug_log_trace
def dispatch_match_gametoom_state_change(blob):
    state_type = blob['matchGameRoomStateChangedEvent']['gameRoomInfo']['stateType']
    if state_type == "MatchGameRoomStateType_Playing":
        parsers.parse_match_playing(blob)
    # elif state_type == "MatchGameRoomStateType_MatchCompleted":
    #     parsers.parse_match_complete(blob)


@util.debug_log_trace
def dispatch_jsonrpc_method(blob):
    """ route what parser to run on this jsonrpc methoc blob

    :param blob: dict, must contain "method" as top level key
    """
    # from app.mtga_app import mtga_watch_app
    # dont_care_rpc_methods = ['Event.DeckSelect', "Log.Info", "Deck.GetDeckLists", "Quest.CompletePlayerQuest"]
    # NOTE: pretty sure these are all useless. Just metadata about RPC methods being called, maybe?
    # ANOTHER NOTE: turns out this might be the only way to get the deck used in a DC. Not useless!
    if "method" in blob and blob["method"] == "DirectGame.Challenge":
        parsers.parse_direct_challenge_queued(blob)


@util.debug_log_trace
def dispatch_gre_to_client(blob):
    client_messages = blob["greToClientEvent"]['greToClientMessages']
    dont_care_types = ["GREMessageType_UIMessage"]
    for message in client_messages:
        message_type = message["type"]
        if message_type in dont_care_types:
            pass
        # TODO: fix this once sideboard logs are also fixed
        # elif message_type == "GREMessageType_SubmitDeckReq":
        #     parsers.parse_sideboard_submit(message["submitDeckReq"])
        elif message_type in ["GREMessageType_GameStateMessage", "GREMessageType_QueuedGameStateMessage"]:
            game_state_message = message['gameStateMessage']
            try:
                parsers.parse_game_state_message(game_state_message, blob["timestamp"] if "timestamp" in blob.keys() else None)
            except:
                import traceback
                exc = traceback.format_exc()
                stack = traceback.format_stack()
                app.mtga_app.mtga_logger.error("{}Exception @ count {}".format(util.ld(True), app.mtga_app.mtga_watch_app.error_count))
                app.mtga_app.mtga_logger.error(exc)
                app.mtga_app.mtga_logger.error(stack)
                app.mtga_app.mtga_watch_app.send_error("Exception during parse game state. Check log for more details")
        elif message_type == "GREMessageType_MulliganReq":
            try:
                parsers.parse_mulligan_req_message(message, blob["timestamp"] if "timestamp" in blob.keys() else None)
            except:
                import traceback
                exc = traceback.format_exc()
                stack = traceback.format_stack()
                app.mtga_app.mtga_logger.error(
                    "{}Exception @ count {}".format(util.ld(True), app.mtga_app.mtga_watch_app.error_count))
                app.mtga_app.mtga_logger.error(exc)
                app.mtga_app.mtga_logger.error(stack)
                app.mtga_app.mtga_watch_app.send_error("Exception during parse game state. Check log for more details")


@util.debug_log_trace
def dispatch_client_to_gre(blob):
    # TODO: seems this is dead code (9/10/18) :(
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
