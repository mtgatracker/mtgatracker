import json
import pprint
import datetime
import util
from app.models.game import Game, Match, Player
from app.models.set import Zone
import app.mtga_app
from app.queues import game_state_change_queue, general_output_queue
from app.models.card import Ability
from mtga import all_mtga_cards


@util.debug_log_trace
def parse_jsonrpc_blob(blob):
    pass


@util.debug_log_trace
def parse_get_decklists(blob, version=1):
    import app.mtga_app as mtga_app
    mtga_app.mtga_watch_app.player_decks = {}
    decks = []

    blob_key = "payload"
    if blob_key in blob:
        for deck in blob[blob_key]:
            decks.append(util.process_deck(deck, version=version))

    return decks


@util.debug_log_trace
def parse_update_deck_v3(blob):
    if "payload" in blob:
        return util.process_deck(blob["payload"])


@util.debug_log_trace
def parse_get_player_cards_v3(blob):
    import app.mtga_app as mtga_app
    pass_through("collection", None, blob)
    mtga_app.mtga_watch_app.collection = blob
    mtga_app.mtga_watch_app.save_settings()


@util.debug_log_trace
def pass_through(title, player_key, blob):
    general_output_queue.put({title: blob, "player_key": player_key})


@util.debug_log_trace
def parse_draft_status(blob):
    # TODO: need to implement the sorting algo shown here:
    # TODO: https://github.com/Fugiman/deckmaster/blob/559e3b94bb105387a0e33463e4b5f718ab91721d/client/updater.go#L113

    """ return a.RarityRank() > b.RarityRank() ||
            (a.RarityRank() == b.RarityRank() && a.ColorRank() > b.ColorRank()) ||
            (a.RarityRank() == b.RarityRank() && a.ColorRank() == b.ColorRank() && a.CMC < b.CMC) ||
            (a.RarityRank() == b.RarityRank() && a.ColorRank() == b.ColorRank() && a.CMC == b.CMC && a.Name < b.Name)"""
    import app.mtga_app as mtga_app

    if "payload" not in blob:
        return
    else:
        blob = blob["payload"]

    collection_count = []
    picked_cards_this_draft = []
    if "pickedCards" in blob and blob["pickedCards"]:
        picked_cards_this_draft = blob["pickedCards"]

    if blob["DraftPack"]:
        for card in blob["DraftPack"]:
            card_obj = util.all_mtga_cards.find_one(card).to_serializable()
            if card in mtga_app.mtga_watch_app.collection:
                card_obj["count"] = min(mtga_app.mtga_watch_app.collection[card] + picked_cards_this_draft.count(card), 4)
            else:
                card_obj["count"] = min(0 + picked_cards_this_draft.count(card), 4)
            collection_count.append(card_obj)
        collection_count.sort(key=lambda x: (-1 * util.rank_rarity(x["rarity"]), util.rank_colors(x["color_identity"]), util.rank_cost(x["cost"]), x["pretty_name"]))
        general_output_queue.put({"draft_collection_count": collection_count})
    else:
        blob["DraftPack"] = []

    draftId = blob["DraftId"]
    picks = picked_cards_this_draft[:]
    pack = blob['DraftPack'][:]

    draft_history = mtga_app.mtga_watch_app.draft_history
    if draft_history.get(draftId, None):
        report = {}
        # report['picks'] = [int(grpid) for grpid in draft_history[draftId]['picks'] ]
        report['draftID'] = draftId
        report['playerID'] = blob["playerId"]
        report['pickNumber'] = draft_history[draftId]['picknum']
        report['packNumber'] = draft_history[draftId]['packnum']
        report['pack'] = [int(grpid) for grpid in draft_history[draftId]['pack']]

        old = draft_history[draftId]['picks'][:]
        new = picks[:]
        for c in old:
            new.remove(c)
        report['pick'] = int(new[0])

        # send report to inspector
        app.mtga_app.mtga_logger.info("{}{}".format(util.ld(), report))
        pass_through("draftPick", report["playerID"], report)
    if pack:
        draft_history[draftId] = {'picks': picks, 'pack': pack, 'picknum': blob["pickNumber"], 'packnum': blob["packNumber"]}
    else:
        draft_history[draftId] = None


@util.debug_log_trace
def parse_event_decksubmit(blob, version=1):
    import app.mtga_app as mtga_app
    if "Courses" in blob:
        course_deck_summary = blob["Courses"][0]["CourseDeckSummary"]
        course_deck = blob["Courses"][0]["CourseDeck"]
        if course_deck_summary and course_deck:
            deck = util.process_deck(course_deck_summary, course_deck, save_deck=False, version=version)
            mtga_app.mtga_watch_app.intend_to_join_game_with = deck


@util.debug_log_trace
def parse_direct_challenge_queued(blob):
    import app.mtga_app as mtga_app
    course_deck = json.loads(blob["params"]["deck"])
    if course_deck:
        deck = util.process_deck(course_deck, save_deck=False)
        mtga_app.mtga_watch_app.intend_to_join_game_with = deck


@util.debug_log_trace
def parse_sideboard_submit(blob):
    import app.mtga_app as mtga_app
    app.mtga_app.mtga_logger.info("{}".format(pprint.pformat(blob)))
    og_deck_id = mtga_app.mtga_watch_app.intend_to_join_game_with.deck_id
    og_deck_name = mtga_app.mtga_watch_app.intend_to_join_game_with.pool_name

    deck_card_ids = blob['Payload']['SubmitDeckResp']["Deck"]["DeckCards"]
    main_deck_lookup = {}
    for card_id in deck_card_ids:
        if card_id not in main_deck_lookup.keys():
            main_deck_lookup[card_id] = {"id": str(card_id), "quantity": 0}
        main_deck_lookup[card_id]["quantity"] += 1
    new_main_deck_list = [i for i in main_deck_lookup.values()]

    sideboard_card_ids = blob['Payload']['SubmitDeckResp']["Deck"]["SideboardCards"]
    sideboard_lookup = {}
    for card_id in sideboard_card_ids:
        if card_id not in sideboard_lookup.keys():
            sideboard_lookup[card_id] = {"id": str(card_id), "quantity": 0}
        sideboard_lookup[card_id]["quantity"] += 1
    new_sideboard_list = [i for i in sideboard_lookup.values()]

    new_deck_obj = {
        "id": og_deck_id,
        "name": og_deck_name,
        "mainDeck": new_main_deck_list,
        "sideboard": new_sideboard_list
    }
    deck = util.process_deck(new_deck_obj, save_deck=False)
    mtga_app.mtga_watch_app.intend_to_join_game_with = deck


# @util.debug_log_trace
# def parse_event_joinqueue(blob):
#     """ TODO: deprecated? """
#     import app.mtga_app as mtga_app
#     # method = 'Event.JoinQueue'
#     params = blob['params']
#     deckId = params['deckId']  # TODO: this will probably now cause a crash
#     return mtga_app.mtga_watch_app.player_decks[deckId]


def parse_mulligan_req_message(message, timestamp=None):
    import app.mtga_app as mtga_app
    number_cards = message["prompt"]["parameters"][0]["numberValue"]
    player_seat_id = message["systemSeatIds"][0]
    player = mtga_app.mtga_watch_app.game.get_player_in_seat(player_seat_id)
    mtga_app.mtga_logger.info("MULL: {}".format(player.hand.cards))
    with mtga_app.mtga_watch_app.game_lock:  # the game state may become inconsistent in between these steps, so lock it
        if number_cards < 6:
            number_mulligans = 6 - number_cards
            starting_hand_size = 7 - number_mulligans
            player.mulligan_count = number_mulligans
            mulligan_text = [" mulligans to ", str(starting_hand_size), ": "]
        else:  # starting hand
            mulligan_text = ["'s starting hand: "]
        player_texts = build_event_texts_from_iid_or_grpid(player_seat_id, mtga_app.mtga_watch_app.game)
        card_texts = []
        for card in player.hand.cards:
            card_texts.append(*build_event_texts_from_iid_or_grpid(card.game_id, mtga_app.mtga_watch_app.game))
        event_texts = [*player_texts, *mulligan_text]
        for card_text in card_texts:
            event_texts.extend([card_text, ", "])
        if event_texts[-1] == ", ":
            event_texts.pop()
        queue_obj = {"game_history_event": event_texts}
        mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
        general_output_queue.put(queue_obj)


# TODO: move somewhere else
def build_event_text(text, event_type, hover_text=None):
    obj = {"text": text, "type": event_type}
    if hover_text:
        obj["hover"] = hover_text
    return obj


def build_card_event_texts(card, game):
    if isinstance(card, Ability):
        owner_is_hero = game.hero == game.get_player_in_seat(card.owner_seat_id)
        text_type = "{}".format("hero" if owner_is_hero else "opponent")
        ability_source = all_mtga_cards.find_one(card.source_id)
        ability_source_text = build_event_text(ability_source.pretty_name, text_type)
        ability_text = build_event_text("ability", "ability", card.pretty_name)
        card_texts = [ability_source_text, "'s ", ability_text]
    elif isinstance(card, Player):
        text_type = "{}".format("hero" if card == game.hero else "opponent")
        card_texts = [build_event_text(card.player_name, text_type)]
    else:  # it's a GameCard
        owner_is_hero = game.hero == game.get_player_in_seat(card.owner_seat_id)
        text_type = "{}".format("hero" if owner_is_hero else "opponent")
        card_texts = [build_event_text(card.pretty_name, text_type)]
    return card_texts


def build_event_texts_from_iid_or_grpid(iid, game, grpid=None):
    if iid < 3:
        return build_card_event_texts(game.get_player_in_seat(iid), game)
    else:
        card_or_ability = game.find_card_by_iid(iid) or game.find_card_by_iid(grpid)
        if not card_or_ability:
            card_or_ability = all_mtga_cards.find_one(iid)
        return build_card_event_texts(card_or_ability, game)

@util.debug_log_trace
def parse_game_state_message(message, timestamp=None):
    # DOM: ok
    import app.mtga_app as mtga_app
    with mtga_app.mtga_watch_app.game_lock:  # the game state may become inconsistent in between these steps, so lock it
        if "turnInfo" in message.keys():
            if "turnNumber" in message["turnInfo"].keys():
                player = mtga_app.mtga_watch_app.game.get_player_in_seat(message["turnInfo"]["activePlayer"])
                if "decisionPlayer" in message["turnInfo"].keys():
                    decisionPlayer = mtga_app.mtga_watch_app.game.get_player_in_seat(message["turnInfo"]["decisionPlayer"])
                else:
                    decisionPlayer = mtga_app.mtga_watch_app.game.last_decision_player
                if timestamp:
                    now = datetime.datetime.now()
                    if mtga_app.mtga_watch_app.game.last_log_timestamp is None:
                        mtga_app.mtga_watch_app.game.last_log_timestamp = timestamp
                        mtga_app.mtga_watch_app.game.last_measured_timestamp = now
                        mtga_app.mtga_watch_app.game.log_start_time = timestamp
                        mtga_app.mtga_watch_app.game.last_decision_player = decisionPlayer

                    measured_time_diff = now - mtga_app.mtga_watch_app.game.last_measured_timestamp
                    log_time_diff = timestamp - mtga_app.mtga_watch_app.game.last_log_timestamp

                    if measured_time_diff > log_time_diff:
                        log_time_diff = measured_time_diff  # some turns are really fast, and the logs see it as 0 seconds. Add what we measured instead,

                    mtga_app.mtga_watch_app.game.last_log_timestamp = timestamp
                    mtga_app.mtga_watch_app.game.last_measured_timestamp = now
                    ct_obj = {"turnInfo": message["turnInfo"],
                              "diff": log_time_diff,
                              "countsAgainst": mtga_app.mtga_watch_app.game.last_decision_player}
                    mtga_app.mtga_watch_app.game.chess_timer.append(ct_obj)
                    general_output_queue.put({"decisionPlayerChange": True, "heroIsDeciding": decisionPlayer == mtga_app.mtga_watch_app.game.hero})
                    mtga_app.mtga_watch_app.game.last_decision_player = decisionPlayer
                mtga_app.mtga_watch_app.game.turn_number = message["turnInfo"]["turnNumber"]
                other_player_seat = 2 if message["turnInfo"]["activePlayer"] == 1 else 1
                other_player = mtga_app.mtga_watch_app.game.get_player_in_seat(other_player_seat)
                mtga_app.mtga_watch_app.game.current_player = player.player_name
                if not mtga_app.mtga_watch_app.game.on_the_play:
                    if message["turnInfo"]["turnNumber"] % 2 == 1:
                        mtga_app.mtga_watch_app.game.on_the_play = player.player_name
                    else:
                        mtga_app.mtga_watch_app.game.on_the_play = other_player.player_name
                mtga_app.mtga_watch_app.game.current_phase = message["turnInfo"]["phase"]
                turn_tuple = (message["turnInfo"]["turnNumber"], "phase")
                if turn_tuple not in mtga_app.mtga_watch_app.game.recorded_targetspecs:
                    mtga_app.mtga_watch_app.game.recorded_targetspecs.append(turn_tuple)
                    turn = turn_tuple[0]
                    active_player_seat = message["turnInfo"]["activePlayer"]
                    active_player = mtga_app.mtga_watch_app.game.get_player_in_seat(active_player_seat)
                    if turn % 2 == 1:
                        text = "{} / {} Turn {}".format(turn, active_player.player_name, int((turn + 1) / 2))
                    else:
                        text = "{} / {} Turn {}".format(turn, active_player.player_name, int((turn / 2)))
                    text_obj = build_event_text(text, "turn")
                    queue_obj = {"game_history_event": [text_obj]}
                    mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
                    general_output_queue.put(queue_obj)
                if "step" in message["turnInfo"].keys():
                    mtga_app.mtga_watch_app.game.current_phase += "-{}".format(message["turnInfo"]["step"])
            mtga_app.mtga_logger.debug(message["turnInfo"])
        if 'gameInfo' in message.keys():
            if 'matchState' in message['gameInfo']:
                game_number = message['gameInfo']['gameNumber']
                game_player_id = "-game{}-{}".format(game_number, mtga_app.mtga_watch_app.game.hero.player_id)
                match_id_raw = message['gameInfo']['matchID']
                match_id = message['gameInfo']['matchID'] + game_player_id

                if 'results' in message['gameInfo']:
                    results = message['gameInfo']['results']
                    parse_game_results(True, match_id, results)
                if message['gameInfo']['matchState'] == "MatchState_GameInProgress" and \
                        game_number > max(len(mtga_app.mtga_watch_app.match.game_results), 1):
                    shared_battlefield = Zone("battlefield")
                    shared_exile = Zone("exile")
                    shared_limbo = Zone("limbo")
                    shared_stack = Zone("stack")
                    new_hero = Player(mtga_app.mtga_watch_app.game.hero.player_name,
                                      mtga_app.mtga_watch_app.game.hero.player_id,
                                      mtga_app.mtga_watch_app.game.hero.seat,
                                      shared_battlefield, shared_exile, shared_limbo, shared_stack,
                                      mtga_app.mtga_watch_app.game.hero._deck_cards)

                    new_oppo = Player(mtga_app.mtga_watch_app.game.opponent.player_name,
                                      mtga_app.mtga_watch_app.game.opponent.player_id,
                                      mtga_app.mtga_watch_app.game.opponent.seat,
                                      shared_battlefield, shared_exile, shared_limbo, shared_stack,
                                      mtga_app.mtga_watch_app.game.opponent._deck_cards)
                    new_hero.is_hero = True
                    if mtga_app.mtga_watch_app.intend_to_join_game_with:
                        new_hero.original_deck = mtga_app.mtga_watch_app.intend_to_join_game_with
                        new_match_id = match_id_raw + "-game{}-{}".format(game_number, new_hero.player_id)
                        mtga_app.mtga_watch_app.game = Game(new_match_id, new_hero, new_oppo, shared_battlefield,
                                                            shared_exile, shared_limbo, shared_stack,
                                                            mtga_app.mtga_watch_app.match.event_id,
                                                            mtga_app.mtga_watch_app.match.opponent_rank)
        if 'annotations' in message.keys():
            for annotation in message['annotations']:
                annotation_type = annotation['type'][0]
                if annotation_type == 'AnnotationType_ObjectIdChanged':
                    try:
                        original_id = None
                        new_id = None
                        details = annotation['details']
                        for detail in details:
                            if detail['key'] == "orig_id":
                                original_id = detail["valueInt32"][0]
                                mtga_app.mtga_watch_app.game.ignored_iids.add(original_id)
                                # NOTE: at one point Spencer thought it might be correct to ignore these AFTER
                                # parsing the whole gameStateMessage, i.e. put these in a list here, and only add them
                                # to ignored_iid's at the end of this function.
                                #
                                # That was incorrect, and led to cards flip-flopping in the UI.
                                # This is correct as is.
                            elif detail['key'] == "new_id":
                                new_id = detail["valueInt32"][0]
                        card_with_iid = mtga_app.mtga_watch_app.game.find_card_by_iid(original_id)
                        if not card_with_iid:  # no one has ref'd yet, we don't care
                            continue
                        new_card_already_exists = mtga_app.mtga_watch_app.game.find_card_by_iid(new_id)
                        if new_card_already_exists:  # just wipe the old card, the new card is already there
                            assert new_card_already_exists.mtga_id == card_with_iid.mtga_id or -1 in [new_card_already_exists.mtga_id, card_with_iid.mtga_id], "{} / {}".format(new_card_already_exists.mtga_id , card_with_iid.mtga_id)
                            card_with_iid.mtga_id = -1
                        else:
                            card_with_iid.previous_iids.append(original_id)
                            card_with_iid.game_id = new_id
                    except:
                        mtga_app.mtga_logger.error("{}Exception @ count {}".format(util.ld(True), mtga_app.mtga_watch_app.error_count))
                        mtga_app.mtga_logger.error("{}parsers:parse_game_state_message - error parsing annotation:".format(util.ld(True)))
                        mtga_app.mtga_logger.error(pprint.pformat(annotation))
                        mtga_app.mtga_watch_app.send_error("Exception during parse AnnotationType_ObjectIdChanged. Check log for more details")
                if annotation_type == "AnnotationType_TargetSpec":
                    affector_id = annotation["affectorId"]
                    affected_ids = annotation["affectedIds"]
                    affector_card = mtga_app.mtga_watch_app.game.find_card_by_iid(affector_id)
                    if not affector_card:
                        # try abilitiy
                        details = annotation["details"]
                        grpid = None
                        for detail in details:
                            if detail["key"] == "grpid":
                                grpid = detail["valueInt32"][0]
                        affector_card = all_mtga_cards.find_one(grpid)
                    targets = []
                    target_texts = []
                    for affected_id in affected_ids:
                        affected_texts = build_event_texts_from_iid_or_grpid(affected_id, mtga_app.mtga_watch_app.game)
                        target_texts.extend(affected_texts)
                        game_obj = mtga_app.mtga_watch_app.game.find_card_by_iid(affected_id)
                        target = game_obj if game_obj else affected_id
                        targets.append(target)
                    if (affector_card, targets) not in mtga_app.mtga_watch_app.game.recorded_targetspecs:
                        mtga_app.mtga_watch_app.game.recorded_targetspecs.append((affector_card, targets))
                        affector_texts = build_card_event_texts(affector_card, mtga_app.mtga_watch_app.game)

                        event_texts = [*affector_texts, " targets "]
                        if len(target_texts) > 2:
                            for target in target_texts:
                                event_texts.extend([target, ", "])
                            event_texts.append(target[-2])
                            event_texts.append(", and")
                            event_texts.append(target[-1])
                        elif len(target_texts) > 1:
                            event_texts.extend([target_texts[-2], " and ", target_texts[-1]])
                        else:
                            event_texts.extend(target_texts)

                        queue_obj = {"game_history_event": event_texts}
                        mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
                        general_output_queue.put(queue_obj)
                if annotation_type == "AnnotationType_ResolutionComplete":
                    try:
                        affector_id = annotation["affectorId"]
                        card = mtga_app.mtga_watch_app.game.find_card_by_iid(affector_id)
                        if isinstance(card, Ability):
                            # card resolutions are handled in annotations below
                            __unused_affected_ids = annotation["affectedIds"]
                            grpid = None
                            details = annotation["details"]
                            for detail in details:
                                if detail["key"] == "grpid":
                                    grpid = detail["valueInt32"][0]
                            resolved_texts = build_event_texts_from_iid_or_grpid(affector_id, mtga_app.mtga_watch_app.game, grpid)
                            event_texts = [*resolved_texts, " resolves"]
                            queue_obj = {"game_history_event": event_texts}
                            mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
                            general_output_queue.put(queue_obj)
                    except:
                        mtga_app.mtga_logger.error("{}Exception @ count {}".format(util.ld(True), mtga_app.mtga_watch_app.error_count))
                        mtga_app.mtga_logger.error("{}parsers:parse_game_state_message - error parsing annotation:".format(util.ld(True)))
                        mtga_app.mtga_logger.error(pprint.pformat(annotation))
                        mtga_app.mtga_watch_app.send_error("Exception during parse AnnotationType_ResolutionComplete. Check log for more details")

        if 'gameObjects' in message.keys():
            game_objects = message['gameObjects']
            for object in game_objects:
                card_id = object['grpId']
                instance_id = object['instanceId']
                if instance_id in mtga_app.mtga_watch_app.game.ignored_iids:
                    continue
                owner = object['controllerSeatId']
                type = object["type"]
                zone = object['zoneId']
                if type not in ["GameObjectType_Card", "GameObjectType_Ability", "GameObjectType_SplitCard", "GameObjectType_Token"]:
                    mtga_app.mtga_watch_app.game.ignored_iids.add(instance_id)
                else:
                    player, zone = mtga_app.mtga_watch_app.game.get_owner_zone_tup(zone)
                    if zone:
                        if not player:
                            player = mtga_app.mtga_watch_app.game.hero
                            # if zone is shared, don't care what player we use to put this card into it
                        assert isinstance(player, Player)
                        if type in ["GameObjectType_Card", "GameObjectType_SplitCard", "GameObjectType_Token"]: # 2022/04/20 GameObjectType_Tokenを追加
                            player.put_instance_id_in_zone(instance_id, owner, zone)
                            zone.match_game_id_to_card(instance_id, card_id)
                        elif type == "GameObjectType_Ability":
                            source_instance_id = object['parentId']
                            source_grp_id = object['objectSourceGrpId']
                            ability_name = all_mtga_cards.find_one(card_id)
                            ability = Ability(ability_name, source_grp_id, source_instance_id, card_id, owner, instance_id)
                            zone.abilities.append(ability)

                if "attackState" in object and object["attackState"] == "AttackState_Attacking":
                    card = mtga_app.mtga_watch_app.game.find_card_by_iid(instance_id)
                    limit_tuple = (mtga_app.mtga_watch_app.game.turn_number, "attacks", card)
                    if limit_tuple not in mtga_app.mtga_watch_app.game.recorded_targetspecs:
                        mtga_app.mtga_watch_app.game.recorded_targetspecs.append(limit_tuple)
                        card_texts = build_event_texts_from_iid_or_grpid(instance_id, mtga_app.mtga_watch_app.game)
                        event_texts = [*card_texts, " attacking"]
                        queue_obj = {"game_history_event": event_texts}
                        mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
                        general_output_queue.put(queue_obj)
                if "blockState" in object and object["blockState"] == "BlockState_Blocking":
                    card = mtga_app.mtga_watch_app.game.find_card_by_iid(instance_id)
                    block_info = object["blockInfo"]
                    attacker_list = block_info["attackerIds"]
                    for attacker in attacker_list:
                        attacker_card = mtga_app.mtga_watch_app.game.find_card_by_iid(attacker)
                        limit_tuple = (mtga_app.mtga_watch_app.game.turn_number, "blocks", card, attacker_card)
                        if limit_tuple not in mtga_app.mtga_watch_app.game.recorded_targetspecs:
                            mtga_app.mtga_watch_app.game.recorded_targetspecs.append(limit_tuple)
                            attacker_texts = build_event_texts_from_iid_or_grpid(attacker, mtga_app.mtga_watch_app.game)
                            blocker_texts = build_event_texts_from_iid_or_grpid(instance_id, mtga_app.mtga_watch_app.game)

                            event_texts = [*blocker_texts, " blocks ", *attacker_texts]
                            queue_obj = {"game_history_event": event_texts}
                            mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
                            general_output_queue.put(queue_obj)
        if 'zones' in message.keys():
            cards_to_remove_from_zones = {}
            for zone in message['zones']:
                try:
                    removable = parse_zone(zone)
                    if removable:
                        cards_to_remove_from_zones[zone["zoneId"]] = removable
                except:
                    mtga_app.mtga_logger.error("{}Exception @ count {}".format(util.ld(True), mtga_app.mtga_watch_app.error_count))
                    mtga_app.mtga_logger.error("{}error parsing zone:".format(util.ld(True)))
                    mtga_app.mtga_logger.error(pprint.pformat(zone))
                    mtga_app.mtga_watch_app.send_error("Exception during parse zone. Check log for more details")
                    import traceback
                    exc = traceback.format_exc()
                    mtga_app.mtga_logger.error(exc)
            for zone_id in cards_to_remove_from_zones.keys():
                remove_these = cards_to_remove_from_zones[zone_id]
                player, zone = mtga_app.mtga_watch_app.game.get_owner_zone_tup(zone_id)
                for card in remove_these:
                    if card in zone.cards:
                        zone.cards.remove(card)
        if message["type"] == "GameStateType_Diff" and "players" in message.keys():
            players = message["players"]
            for player in players:
                seat = player["systemSeatNumber"]
                player_obj = mtga_app.mtga_watch_app.game.get_player_in_seat(seat)
                life_total = player["lifeTotal"] if "lifeTotal" in player else player_obj.current_life_total
                if player_obj.current_life_total != life_total:
                    player_is_hero = mtga_app.mtga_watch_app.game.hero == player_obj
                    player_life_text_type = "{}".format("hero" if player_is_hero else "opponent")
                    player_life_text = build_event_text(player_obj.player_name, player_life_text_type)
                    event_texts = [player_life_text, "'s life total changed ", "{} -> {}".format(player_obj.current_life_total, life_total)]
                    queue_obj = {"game_history_event": event_texts}
                    mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
                    general_output_queue.put(queue_obj)
                    player_obj.current_life_total = life_total
        # AFTER we've processed gameObjects, look for actions that should go in the log
        # If this code is in the block above gameObjects, then we will end up with lots of
        # "unknown" cards for opponent cards and actions
        if 'annotations' in message.keys():
            for annotation in message['annotations']:
                annotation_type = annotation['type'][0]
                if annotation_type == "AnnotationType_ZoneTransfer":
                    if "affectorId" not in annotation.keys():
                        affector_id = 0
                    else:
                        affector_id = annotation["affectorId"]
                    affected_ids = annotation["affectedIds"]
                    details = annotation["details"]
                    zone_src, zone_dest, category = None, None, None
                    for detail in details:
                        if detail["key"] == "zone_src":
                            zone_src = detail["valueInt32"][0]
                        if detail["key"] == "zone_dest":
                            zone_dest = detail["valueInt32"][0]
                        if detail["key"] == "category":
                            category = detail["valueString"][0]

                    card = mtga_app.mtga_watch_app.game.find_card_by_iid(affected_ids[0])
                    if affector_id == 0:
                        affector_id = card.owner_seat_id
                    player_texts = build_event_texts_from_iid_or_grpid(affector_id, mtga_app.mtga_watch_app.game)
                    annotation_texts = build_event_texts_from_iid_or_grpid(affected_ids[0], mtga_app.mtga_watch_app.game)

                    if category == "PlayLand":
                        event_texts = [*player_texts, " plays ", *annotation_texts]
                        queue_obj = {"game_history_event": event_texts}
                        mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
                        general_output_queue.put(queue_obj)
                    elif category == "Draw":
                        if affector_id > 2:
                            owner = card.owner_seat_id
                            player_texts.extend([": ", *build_event_texts_from_iid_or_grpid(owner, mtga_app.mtga_watch_app.game)])
                        if card.pretty_name == "unknown":
                            event_texts = [*player_texts, " draws"]
                        else:
                            event_texts = [*player_texts, " draws ", *annotation_texts]
                        queue_obj = {"game_history_event": event_texts}
                        mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
                        general_output_queue.put(queue_obj)
                        # build draw log event
                    elif category == "CastSpell":
                        event_texts = [*player_texts, " casts ", *annotation_texts]
                        queue_obj = {"game_history_event": event_texts}
                        mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
                        general_output_queue.put(queue_obj)
                        # build draw log event
                        # TODO: see if this is redundant
                    elif category == "Countered":
                        event_texts = [*player_texts, " counters ", *annotation_texts]
                        queue_obj = {"game_history_event": event_texts}
                        mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
                        general_output_queue.put(queue_obj)
                    elif category == "Resolve":
                        event_texts = [*annotation_texts, " resolves"]
                        queue_obj = {"game_history_event": event_texts}
                        mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
                        general_output_queue.put(queue_obj)
                    elif category == "Exile":
                        event_texts = [*player_texts, " exiles ", *annotation_texts]
                        queue_obj = {"game_history_event": event_texts}
                        mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
                        general_output_queue.put(queue_obj)
                    # TODO: category == "Put" ?
                    elif zone_dest == 37 or zone_dest == 33:  # TODO: get rid of this hardcoded bs
                        event_texts = [*annotation_texts, " sent to graveyard ", "(" + category + ")"]
                        queue_obj = {"game_history_event": event_texts}
                        mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
                        general_output_queue.put(queue_obj)
                    # TODO: 他のゾーン遷移のログを出力する
                    else:
                        print("zone_src:"+zone_src+", zone_dst:"+zone_dest+", category:"+category)
                if annotation_type == "AnnotationType_TokenCreated":
                    # TODO: トークン生成
                    if "affectorId" not in annotation.keys():
                        affector_id = 0
                    else:
                        affector_id = annotation["affectorId"]
                    affected_ids = annotation["affectedIds"]
                    for affected_id in affected_ids:
                        card = mtga_app.mtga_watch_app.game.find_card_by_iid(affected_id)
                        if affector_id == 0:
                            affector_id = card.owner_seat_id
                        player_texts = build_event_texts_from_iid_or_grpid(affector_id, mtga_app.mtga_watch_app.game)
                        annotation_texts = build_event_texts_from_iid_or_grpid(affected_id, mtga_app.mtga_watch_app.game)
                        event_texts = [*player_texts, " creates ", *annotation_texts]
                        queue_obj = {"game_history_event": event_texts}
                        mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
                        general_output_queue.put(queue_obj)



@util.debug_log_trace
def parse_zone(zone_blob):
    import app.mtga_app as mtga_app
    trackable_zones = ["ZoneType_Hand", "ZoneType_Library", "ZoneType_Graveyard", "ZoneType_Exile", "ZoneType_Limbo",
                       "ZoneType_Stack", "ZoneType_Battlefield"]
    zone_type = zone_blob["type"]
    if zone_type not in trackable_zones:
        return []
    owner_seat = None
    mtga_app.mtga_watch_app.game.register_zone(zone_blob)  # make sure we will find the zone later
    zone_id = zone_blob["zoneId"]
    player, zone = mtga_app.mtga_watch_app.game.get_owner_zone_tup(zone_id)
    if not zone:
        if "ownerSeatId" in zone_blob:
            owner_seat = zone_blob["ownerSeatId"]
            player = mtga_app.mtga_watch_app.game.get_player_in_seat(owner_seat)
            zone = player.get_zone_by_name(zone_type)
            zone.zone_id = zone_id
    if zone and not player:
        # we don't care if there is no owner (i.e. a shared zone), we just need a player to reference
        player = mtga_app.mtga_watch_app.game.hero
    if 'objectInstanceIds' in zone_blob:
        for instance_id in zone_blob['objectInstanceIds']:
            if instance_id in mtga_app.mtga_watch_app.game.ignored_iids:
                continue
            if "ownerSeatId" not in zone_blob:
                card = mtga_app.mtga_watch_app.game.find_card_by_iid(instance_id)
                if card:
                    owner_seat = card.owner_seat_id
            if not owner_seat and "ownerSeatId" in zone_blob:
                owner_seat = zone_blob["ownerSeatId"]
            # TODO: logging
            # mtga_logger.info("adding {} to {}".format(instance_id, zone))
            if owner_seat:
                player.put_instance_id_in_zone(instance_id, owner_seat,  zone)
        cards_to_remove_from_zone = []
        for card in zone.cards:
            if card.game_id not in zone_blob['objectInstanceIds']:
                cards_to_remove_from_zone.append(card)
        return cards_to_remove_from_zone


@util.debug_log_trace
def parse_mulligan_response(blob):
    import app.mtga_app as mtga_app
    if blob["mulliganResp"]["decision"] == "MulliganOption_Mulligan":
        player = mtga_app.mtga_watch_app.game.get_player_in_seat(blob["systemSeatId"])
        player.do_mulligan()


@util.debug_log_trace
def parse_accept_hand(blob):
    import app.mtga_app as mtga_app
    client_message = blob['clientToGreMessage']
    response = client_message['mulliganResp']['decision']
    if response == "MulliganOption_AcceptHand":
        with mtga_app.mtga_watch_app.game_lock:
            mtga_app.mtga_watch_app.game.hero.deck.transfer_cards_to(mtga_app.mtga_watch_app.game.temp["my_mulligan"],
                                                                     mtga_app.mtga_watch_app.game.hero.hand)


@util.debug_log_trace
def parse_game_results(_unused_locked, match_id, result_list):
    import app.mtga_app as mtga_app
    for idx, result in enumerate(result_list):
        if not app.mtga_app.mtga_watch_app.match.has_results(idx):
            # scope = result["scope"]
            # if scope == 'MatchScope_Match':  # TODO: with BO3, check games too. (might be in a different event type)
            winning_team = result["winningTeamId"]

            mtga_app.mtga_watch_app.game.final = True
            mtga_app.mtga_watch_app.game.winner = mtga_app.mtga_watch_app.game.get_player_in_seat(winning_team)
            # let electron handle the upload
            result = {
                "match_complete": True,
                "game": mtga_app.mtga_watch_app.game.to_json()
            }

            if "end" not in mtga_app.mtga_watch_app.game.recorded_targetspecs:
                mtga_app.mtga_watch_app.game.recorded_targetspecs.append("end")
                reason = None
                if "reason" in result.keys():
                    reason = result["reason"].split("_")[1]

                won_text = "{} won!".format(mtga_app.mtga_watch_app.game.winner.player_name)
                if reason:
                    won_text += "({})".format(reason)

                event_text = build_event_text(won_text, "game")

                event_texts = [event_text]
                queue_obj = {"game_history_event": event_texts}
                mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
                general_output_queue.put(queue_obj)

            app.mtga_app.mtga_watch_app.match.add_result(result)
            game_state_change_queue.put(result)
            if match_id != mtga_app.mtga_watch_app.game.match_id:
                fstr = "match_id {} ended, but doesn't match current game object ({})!"
                raise Exception(fstr.format(match_id, mtga_app.mtga_watch_app.game.match_id))


# TODO: turn this back on to track BO3 _event_ result instead of each game
# @util.debug_log_trace
# def parse_match_complete(blob):
#     game_room_info = blob['matchGameRoomStateChangedEvent']['gameRoomInfo']
#     final_match_result = game_room_info['finalMatchResult']
#     result_list = final_match_result["resultList"]
#     match_id = game_room_info['gameRoomConfig']['matchId']
#     parse_game_results(match_id, 1, result_list)


@util.debug_log_trace
def parse_match_created(blob):
    import app.mtga_app as mtga_app
    with mtga_app.mtga_watch_app.game_lock:
        mtga_app.mtga_watch_app.match = Match(blob["matchId"])


@util.debug_log_trace
def parse_match_playing(blob):
    # MatchGameRoomStateType_Playing
    import app.mtga_app as mtga_app
    temp_players = {
        1: {},
        2: {}
    }
    game_room_info = blob["matchGameRoomStateChangedEvent"]["gameRoomInfo"]
    game_room_players = game_room_info["players"]
    game_room_config = game_room_info["gameRoomConfig"]
    event_id = game_room_config['eventId']

    for player in game_room_players:
        temp_players[player["systemSeatId"]]["player_id"] = player["userId"]
        if game_room_config["clientMetadata"].get(player["userId"]+"_RankClass") and game_room_config["clientMetadata"].get(player["userId"]+"_RankTier"):
            temp_players[player["systemSeatId"]]["rank"] = game_room_config["clientMetadata"].get(player["userId"]+"_RankClass")+" "+game_room_config["clientMetadata"].get(player["userId"]+"_RankTier")
        else:
            temp_players[player["systemSeatId"]]["rank"] = "Unknown"

    reserved_players = game_room_config["reservedPlayers"]
    for player in reserved_players:
        temp_players[player["systemSeatId"]]["name"] = player["playerName"]
        temp_players[player["systemSeatId"]]["screenName"] = player["playerName"].split("#")[0]

    match_config = game_room_config.get("matchConfig")
    if match_config and "teams" in match_config:
        teams = match_config["teams"]
        for team in teams:
            players = team["players"]
            for player in players:
                player_seat = player["systemSeatId"]
                temp_players[player_seat]["deck"] = util.card_ids_to_card_list(player["deckCards"])
    for player_idx in [1,2]:
        if "deck" not in temp_players[player_idx]:
            temp_players[player_idx]["deck"] = []
    # set up shared zones
    shared_battlefield = Zone("battlefield")
    shared_exile = Zone("exile")
    shared_limbo = Zone("limbo")
    shared_stack = Zone("stack")
    player1 = Player(temp_players[1]["name"], temp_players[1]["player_id"], 1, shared_battlefield,
                     shared_exile, shared_limbo, shared_stack, temp_players[1]["deck"])
    player2 = Player(temp_players[2]["name"], temp_players[2]["player_id"], 2, shared_battlefield,
                     shared_exile, shared_limbo, shared_stack, temp_players[2]["deck"])
    with mtga_app.mtga_watch_app.game_lock:
        mtga_app.mtga_watch_app.match.event_id = event_id
        if mtga_app.mtga_watch_app.player_id == player1.player_id:
            hero = player1
            opponent = player2
            mtga_app.mtga_watch_app.match.opponent_name = temp_players[1]["screenName"]
            mtga_app.mtga_watch_app.match.opponent_rank = temp_players[1]["rank"]
        elif mtga_app.mtga_watch_app.player_id == player2.player_id:
            hero = player2
            opponent = player1
            mtga_app.mtga_watch_app.match.opponent_name = temp_players[2]["screenName"]
            mtga_app.mtga_watch_app.match.opponent_rank = temp_players[2]["rank"]
        else:
            raise Exception("Don't know who hero is: player_id: {} / player 1: {} / player 2: {}".format(mtga_app.mtga_watch_app.player_id, player1.player_id, player2.player_id))

        hero.is_hero = True
        if mtga_app.mtga_watch_app.intend_to_join_game_with:
            hero.original_deck = mtga_app.mtga_watch_app.intend_to_join_game_with
        opponent_rank = "Unknown"
        if mtga_app.mtga_watch_app.match.opponent_name == opponent.player_name:
            opponent_rank = mtga_app.mtga_watch_app.match.opponent_rank
        match_id = game_room_info['gameRoomConfig']['matchId'] + "-game1-{}".format(hero.player_id)

        hero_text = build_event_text(hero.player_name, "hero")
        oppo_text = build_event_text(opponent.player_name, "opponent")

        event_texts = [hero_text, " vs ", oppo_text]
        queue_obj = {"game_history_event": event_texts}
        general_output_queue.put(queue_obj)
        mtga_app.mtga_watch_app.game = Game(match_id, hero, opponent, shared_battlefield, shared_exile, shared_limbo,
                                            shared_stack, event_id, opponent_rank)
        mtga_app.mtga_watch_app.game.events.append(queue_obj["game_history_event"])
