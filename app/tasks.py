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
        square_index = block_recieved.index("[") if "[" in block_recieved else -1
        curly_index = block_recieved.index("{") if "{" in block_recieved else -1
        if square_index != -1 and (square_index < curly_index or curly_index == -1):
            # TODO: this, but better
            """ 
            found a log with a block that looked like this:

            ```
            Unloading 6 Unused Serialized files (Serialized files now loaded: 46)
            3/6/2018 9:35:53 PM: Match to 6A250A78F6933705: GreToClientEvent
            {
              "greToClientEvent": {
               ...
            ```

            so it misses the elif clause below. I guess delete the crap in front of it? shrugggg
            """
            # try list first
            pre_block = block_recieved[:square_index]
            if " " in pre_block:
                block_title = pre_block.split(" ")[-2]
                block_recieved = block_title + " " + block_recieved[square_index:]
            else:
                block_recieved = block_recieved[square_index:]
        if curly_index != -1 and (curly_index < square_index or square_index == -1):
            pre_block = block_recieved[:curly_index]
            if " " in pre_block:
                block_title = pre_block.split(" ")[-2]
                block_recieved = block_title + " " + block_recieved[curly_index:]
            else:
                block_recieved = block_recieved[curly_index:]
            # try object parsing
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
                mtga_logger.error("Could not parse list_blob {}".format(list_blob))
                mtga_watch_app.send_error("Could not parse list_blob {}".format(list_blob))
        elif first_line and first_line[-1] == "{" or second_line and second_line == "{":
            idx_first_bracket = block_recieved.index("{")
            idx_last_bracket = block_recieved.rindex("}") + 1

            json_blob = block_recieved[idx_first_bracket:idx_last_bracket]
            try:
                blob = json.loads(json_blob)
                if block_title:
                    blob["block_title"] = block_title.strip()
                out_queue.put(blob)
            except:
                mtga_logger.error("Could not parse json_blob {}".format(json_blob))
                mtga_watch_app.send_error("Could not parse json_blob {}".format(json_blob))


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
                    game_state_change_queue.put({"match_complete": True})
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



