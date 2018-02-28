import json
import util
import app.dispatchers as dispatchers
from app.mtga_app import mtga_watch_app, mtga_logger
from app.queues import all_die_queue, game_state_change_queue


def block_watch_task(in_queue, out_queue):
    while all_die_queue.empty():
        block_recieved = in_queue.get()
        if block_recieved is None:
            out_queue.put(None)
            break
        block_lines = block_recieved.split("\n")
        first_line = block_lines[0].strip()
        second_line = None
        if len(block_lines) > 1:
            second_line = block_lines[1].strip()
        if first_line and first_line[-1] == "[":
            list_name = first_line.split(" ")[-2]
            idx_first_sq_bracket = block_recieved.index("[")
            idx_last_sq_bracket = block_recieved.rindex("]") + 1
            list_blob = '{{"{}": '.format(list_name) + block_recieved[idx_first_sq_bracket:idx_last_sq_bracket] + " }"
            try:
                blob = json.loads(list_blob)
                out_queue.put(blob)
            except:
                mtga_logger.info("----- ERROR parsing list json blob  :( `{}`".format(list_blob))
        elif first_line and first_line[-1] == "{" or second_line and second_line == "{":
            idx_first_bracket = block_recieved.index("{")
            idx_last_bracket = block_recieved.rindex("}") + 1

            json_blob = block_recieved[idx_first_bracket:idx_last_bracket]
            try:
                blob = json.loads(json_blob)
                out_queue.put(blob)
            except:
                mtga_logger.info("----- ERROR parsing normal json blob :( `{}`".format(json_blob))


def json_blob_reader_task(in_queue, out_queue):

    def check_for_client_id(blob):
        if "clientId" in blob:
            with mtga_watch_app.game_lock:
                if mtga_watch_app.player_id != blob['clientId']:
                    mtga_watch_app.player_id = blob['clientId']
                    mtga_logger.debug("got new clientId")
                    mtga_watch_app.save_settings()

    last_blob = None
    error_count = 0
    while all_die_queue.empty():
        json_recieved = in_queue.get()

        if json_recieved is None:
            out_queue.put(None)
            break

        if last_blob == json_recieved:
            continue  # don't double fire
        try:
            hero_library_hash = -1
            opponent_hand_hash = -1
            if mtga_watch_app.game:
                hero_library_hash = hash(mtga_watch_app.game.hero.library)
                opponent_hand_hash = hash(mtga_watch_app.game.opponent.hand)
            util.dense_log(json_recieved)
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
                game_state_change_queue.put(mtga_watch_app.game.game_state())
                print("putting to queue {}".format(game_state_change_queue.qsize()))
        except:
            import traceback
            exc = traceback.format_exc()
            stack = traceback.format_stack()
            error_count += 1
            mtga_logger.error(exc)
            mtga_logger.error(stack)
            if error_count > 5:
                mtga_logger.error("error count too high; exiting")
                return

        last_blob = json_recieved



