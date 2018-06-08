import json
import app.dispatchers as dispatchers
from app.mtga_app import mtga_watch_app, mtga_logger
from app.queues import all_die_queue, game_state_change_queue, decklist_change_queue


def block_watch_task(in_queue, out_queue):
    while all_die_queue.empty():
        block_recieved = in_queue.get()
        if block_recieved is None:
            out_queue.put(None)
            break
        if "[" not in block_recieved and "{" not in block_recieved:
            continue
        block_lines = block_recieved.split("\n")
        if len(block_lines) < 2:
            continue
        title_line = block_lines[1]
        block_title = " ".join(title_line.split(" ")[1:]).split("(")[0]
        block_title_seq = None

        if "(" in title_line and ")" in title_line:
            block_title_seq = title_line.split("(")[1].split(")")[0]  # wtf is this thing?

        if title_line and title_line.startswith("==>") or title_line.startswith("<=="):
            json_str = "\n".join(block_lines[2:])
            try:
                blob = json.loads(json_str)
                mtga_logger.debug("success parsing blob: {}({})".format(block_title, block_title_seq))
                if block_title:
                    blob["block_title"] = block_title.strip()
                if block_title_seq:
                    blob["block_title_sequence"] = block_title_seq
                out_queue.put(blob)
            except:
                mtga_logger.error("Could not parse json_blob {}".format(json_str))
                mtga_watch_app.send_error("Could not parse json_blob {}".format(json_str))


def json_blob_reader_task(in_queue, out_queue):

    def check_for_client_id(blob):
        if "clientId" in blob:
            with mtga_watch_app.game_lock:
                if mtga_watch_app.player_id != blob['clientId']:
                    mtga_watch_app.player_id = blob['clientId']
                    mtga_logger.debug("got new clientId")
                    mtga_watch_app.save_settings()

    last_blob = None
    last_decklist = None
    error_count = 0
    while all_die_queue.empty():
        json_recieved = in_queue.get()

        if json_recieved is None:
            out_queue.put(None)
            break

        if last_blob == json_recieved:
            continue  # don't double fire

        # check for decklist changes
        if mtga_watch_app.player_decks != last_decklist:
            last_decklist = mtga_watch_app.player_decks
            decklist_change_queue.put({k: v.to_serializable(transform_to_counted=True) for k, v in last_decklist.items()})

        # check for gamestate changes
        try:
            hero_library_hash = -1
            opponent_hand_hash = -1
            if mtga_watch_app.game:
                hero_library_hash = hash(mtga_watch_app.game.hero.library)
                opponent_hand_hash = hash(mtga_watch_app.game.opponent.hand)

            check_for_client_id(json_recieved)
            dispatchers.dispatch_blob(json_recieved)
            mtga_watch_app.last_blob = json_recieved
            error_count = 0

            hero_library_hash_post = -1
            opponent_hand_hash_post = -1
            if mtga_watch_app.game:
                hero_library_hash_post = hash(mtga_watch_app.game.hero.library)
                opponent_hand_hash_post = hash(mtga_watch_app.game.opponent.hand)
                if hero_library_hash != hero_library_hash_post or opponent_hand_hash != opponent_hand_hash_post:
                    game_state_change_queue.put(mtga_watch_app.game.game_state())  # TODO: BREAKPOINT HERE
                if mtga_watch_app.game.final:
                    game_state_change_queue.put({"match_complete": True, "gameID": mtga_watch_app.game.match_id})
        except:
            import traceback
            exc = traceback.format_exc()
            stack = traceback.format_stack()
            mtga_logger.error("Exception @ count {}".format(mtga_watch_app.error_count))
            mtga_logger.error(exc)
            mtga_logger.error(stack)
            mtga_watch_app.send_error("Exception during check game state. Check log for more details")
            if error_count > 5:
                mtga_logger.error("error count too high; exiting")
                return

        last_blob = json_recieved



