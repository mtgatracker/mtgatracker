import dateutil.parser
import json
import app.dispatchers as dispatchers
from app.mtga_app import mtga_watch_app, mtga_logger
from app.queues import all_die_queue, game_state_change_queue, decklist_change_queue, general_output_queue
import util

"""

(Filename: C:/buildslave/unity/build/artifacts/generated/common/runtime/DebugBindings.gen.cpp Line: 51)

[UnityCrossThreadLogger]6/7/2018 7:21:03 PM: Match to 26848417E29213FE: GreToClientEvent
{
  "transactionId": "6b0a3194-d8bd-4c5e-9cc3-326090a87460",
  "timestamp": "636640212640633214",
  "greToClientEvent": {
    "greToClientMessages": [
      {
      
      
      vs
      
      
[UnityCrossThreadLogger]6/7/2018 7:21:03 PM
==> Log.Info(530):
{
"""


def block_watch_task(in_queue, out_queue):
    while all_die_queue.empty():
        block_recieved = in_queue.get()
        if block_recieved is None:
            out_queue.put(None)
            break

        log_line = None
        if isinstance(block_recieved, tuple):
            log_line, block_recieved = block_recieved

        if "[" not in block_recieved and "{" not in block_recieved:
            continue
        block_lines = block_recieved.split("\n")
        if len(block_lines) < 2:
            continue

        request_or_response = None
        json_str = ""  # hit the ex
        timestamp = None
        block_title_seq = None

        if block_lines[1] and block_lines[1].startswith("==>") or block_lines[1].startswith("<=="):
            """
            these logs looks like:
            
            [UnityCrossThreadLogger]6/7/2018 7:21:03 PM
            ==> Log.Info(530):
            {
                "json": "stuff"
            }
            """
            title_line = block_lines[1]
            block_title = " ".join(title_line.split(" ")[1:]).split("(")[0]
            block_title_seq = None

            if "(" in title_line and ")" in title_line:
                block_title_seq = title_line.split("(")[1].split(")")[0]  # wtf is this thing?
            request_or_response = "response"
            if title_line.startswith("==>"):
                request_or_response = "request"

            json_str = "\n".join(block_lines[2:]).strip()
            if json_str.startswith("["):
                # this is not valid json, we need to surround it with a header such that it's an object instead of a list
                json_str = '{{"{}": {}}}'.format(block_title, json_str)
        elif block_lines[1].strip() == "{":
            """ DEPRECATED
            these logs look like:
            
            [UnityCrossThreadLogger]6/7/2018 7:21:03 PM: Match to 26848417E29213FE: GreToClientEvent
            {
              "json": "stuff"
            }
            """
            try:
                timestamp = dateutil.parser.parse(block_lines[0].split("]")[1].split(": ")[0])
            except:
                pass
            block_title = block_lines[0].split(" ")[-1]
            json_str = "\n".join(block_lines[1:])
        elif block_lines[1].strip()[0] == "{":

            """
            these logs look like:

            [UnityCrossThreadLogger]6/7/2018 7:21:03 PM: Match to 26848417E29213FE: GreToClientEvent
            { "json": "stuff" }
            extra_stuff_down_here
            """
            try:
                timestamp = dateutil.parser.parse(block_lines[0].split("]")[1].split(": ")[0])
            except:
                pass
            block_title = block_lines[0].split(" ")[-1]
            json_str = "\n".join(block_lines[1:])
        elif block_lines[1].strip().endswith("{"):
            """
            these blocks looks like: 
            
            [UnityCrossThreadLogger]7/2/2018 10:27:59 PM
            (-1) Incoming Rank.Updated {
              "json": "stuff
            }
            """
            block_title = block_lines[1].strip().split(" ")[-2]  # skip trailing {
            json_str = "{" + "\n".join(block_lines[2:])          # cut the first two lines and manually add { back in
        if json_str:
            try:
                blob = json.loads(json_str)
                # useful: next time you're trying to figure out why a blob isn't getting through the queue:
                # if "DirectGame" in json_str and "method" in blob:
                #     import pprint
                #     pprint.pprint(blob)
                if log_line:
                    blob["log_line"] = log_line
                if timestamp:
                    blob["timestamp"] = timestamp
                mtga_logger.info("{}success parsing blob: {}({}) / log_line {}".format(util.ld(), block_title, block_title_seq, log_line))
                if request_or_response:
                    blob["request_or_response"] = request_or_response
                if block_title:
                    blob["block_title"] = block_title.strip()
                if block_title_seq:
                    blob["block_title_sequence"] = block_title_seq
                out_queue.put(blob)
            except Exception as e:
                mtga_logger.error("{}Could not parse json_blob `{}`".format(util.ld(), json_str))
                mtga_watch_app.send_error("Could not parse json_blob {}".format(json_str))


def json_blob_reader_task(in_queue, out_queue):

    def check_for_client_id(blob):
        if "authenticateResponse" in blob:
            if "clientId" in blob["authenticateResponse"]:
                # screw it, no one else is going to use this message, mess up the timestamp, who cares
                with mtga_watch_app.game_lock:
                    if mtga_watch_app.player_id != blob["authenticateResponse"]['clientId']:
                        mtga_watch_app.player_id = blob["authenticateResponse"]['clientId']
                        mtga_logger.debug("{}check_for_client_id: got new clientId".format(util.ld()))
                        mtga_watch_app.save_settings()
                general_output_queue.put({"authenticateResponse": blob["authenticateResponse"]})

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
            mtga_logger.error("{}Exception @ count {}".format(util.ld(True), mtga_watch_app.error_count))
            mtga_logger.error(exc)
            mtga_logger.error(stack)
            mtga_watch_app.send_error("Exception during check game state. Check log for more details")
            if error_count > 5:
                mtga_logger.error("{}error count too high; exiting".format(util.ld()))
                return

        last_blob = json_recieved



