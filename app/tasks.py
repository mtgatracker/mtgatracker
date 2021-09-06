import dateutil.parser
import json
import traceback
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
    BLOCK_SEQ = 0
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

        request_or_response = None
        is_timestamp_only = False
        block_title = ""
        json_str = ""  # hit the ex
        timestamp = None
        if block_lines[0] and block_lines[0].startswith("[UnityCrossThreadLogger]"):
            line = block_lines[0].split("[UnityCrossThreadLogger]")[1].strip()

            # starts with request or response or non-message event
            if line.startswith("==>"):
                request_or_response = "request"
                line = line.split("==>")[1].strip()
            elif line.startswith("<=="):    # never appear
                request_or_response = "response"
                line = line.split("<==")[1].strip()
            elif line.startswith("non-message event:"):
                line = line.split("non-message event:")[1].strip()

            # starts with timestamp
            try:
                timestamp = dateutil.parser.parse(line.split(": ")[0])
                if len(line.split(": ")) == 1:
                    is_timestamp_only = True
            except:
                pass

            indexes = []
            if line.startswith("Connecting to matchId"):    # Connecting to matchId
                block_title = "Connecting to matchId"
                json_str = "{ \"matchId\": \""+line.split("Connecting to matchId")[1].strip()+"\" }"
            elif line.startswith("non-message event"):    # non-message event
                block_title = line.split(": ")[-1].strip()
            elif line.startswith("[GraphMan]"):    # [GraphMan]
                block_title = line.strip()
            elif "{" in line or "[" in line:  # has JSON string in line
                indexes = []
                if "{" in line:
                    indexes.append(line.index("{"))
                if "[" in line:
                    indexes.append(line.index("["))
                first_open_bracket = min(indexes)
                block_title = line[:first_open_bracket].strip()
                json_str = line[first_open_bracket:].strip()
            elif "(" in line:   # has no JSON string but "("
                first_open_bracket = line.index("(")
                block_title = line[:first_open_bracket].strip()
            elif "Match to" in line or "to Match" in line:   # Match to clientId, clientId to Match
                block_title = line.split(": ")[-1]
                if len(block_lines) >= 2:
                    json_str = "\n".join(block_lines[1:])
            elif is_timestamp_only and len(block_lines) >= 3:   # response
                if block_lines[1].startswith("<=="):
                    request_or_response = "response"
                    block_title = block_lines[1].split("<==")[1].split("(")[0].strip()
                    if block_lines[2].startswith("{") or block_lines[2].startswith("["):
                        json_str = "\n".join(block_lines[2:])
                elif block_lines[1].startswith("("):    #transactionId
                    block_title = " ".join(block_lines[1].split(" ")[1:-1])

        if json_str:
            if not json_str.startswith("[Message summarized"):
                # [Message summarized because one or more GameStateMessages exceeded the 50 GameObject or 50 Annotation limit.]
                try:
                    blob = json.loads(json_str)
                    BLOCK_SEQ += 1
                    # useful: next time you're trying to figure out why a blob isn't getting through the queue:
                    # if "DirectGame" in json_str and "method" in blob:
                    #     import pprint
                    #     pprint.pprint(blob)
                    if log_line and isinstance(blob, dict):
                        blob["log_line"] = log_line
                    if timestamp and isinstance(blob, dict):
                        blob["timestamp"] = timestamp
                    mtga_logger.info("{}success parsing blob: {} / log_line {}".format(util.ld(), block_title, log_line))
                    if request_or_response and isinstance(blob, dict):
                        blob["request_or_response"] = request_or_response
                    if block_title and isinstance(blob, dict):
                        blob["block_title"] = block_title.strip()
                    if isinstance(blob, dict):
                        blob["block_title_sequence"] = BLOCK_SEQ
                    out_queue.put(blob)
                except Exception as e:
                    mtga_logger.error("{}Could not parse json_blob `{}`".format(util.ld(), json_str))
                    mtga_logger.error("{}".format(traceback.format_exc())) #debug
                    mtga_watch_app.send_error("Could not parse json_blob {}".format(json_str))


def json_blob_reader_task(in_queue, out_queue):

    def check_for_client_id(blob):
        if "authenticateResponse" in blob:
            if isinstance(blob, dict) and "clientId" in blob["authenticateResponse"]:
                # screw it, no one else is going to use this message, mess up the timestamp, who cares
                with mtga_watch_app.game_lock:
                    if mtga_watch_app.player_id != blob["authenticateResponse"]["clientId"]:
                        mtga_watch_app.player_id = blob["authenticateResponse"]["clientId"]
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



