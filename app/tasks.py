import json
import util
import app.dispatchers as dispatchers
from app.queues import all_die_queue


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
                print("----- ERROR parsing list json blob  :( `{}`".format(list_blob))
        elif first_line and first_line[-1] == "{" or second_line and second_line == "{":
            idx_first_bracket = block_recieved.index("{")
            idx_last_bracket = block_recieved.rindex("}") + 1

            json_blob = block_recieved[idx_first_bracket:idx_last_bracket]
            try:
                blob = json.loads(json_blob)
                out_queue.put(blob)
            except:
                print("----- ERROR parsing normal json blob :( `{}`".format(json_blob))


def json_blob_reader_task(in_queue, out_queue):

    def check_for_client_id(blob):
        import app.mtga_app as mtga_app
        if "clientId" in blob:
            with mtga_app.mtga_watch_app.game_lock:
                mtga_app.mtga_watch_app.player_id = blob['clientId']

    last_blob = None
    while all_die_queue.empty():
        json_recieved = in_queue.get()

        if json_recieved is None:
            out_queue.put(None)
            break

        if last_blob == json_recieved:
            continue  # don't double fire

        util.dense_log(json_recieved)
        check_for_client_id(json_recieved)
        dispatchers.dispatch_blob(json_recieved)

        last_blob = json_recieved



