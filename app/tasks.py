import json
import os
from queue import Empty

import tailer
import multiprocessing

from app.queues import block_read_queue, json_blob_queue
from util import print_deck, process_deck

appdata_roaming = os.getenv("APPDATA")
wotc_locallow_path = os.path.join(appdata_roaming, "..", "LocalLow", "Wizards Of The Coast", "MTGA")
output_log = os.path.join(wotc_locallow_path, "output_log.txt")


def block_watch_task(in_queue, out_queue):
    while True:
        block_recieved = in_queue.get()
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

        if block_recieved is None:
            break


# slash of talons
def json_blob_reader_task(in_queue, out_queue):
    last_blob = None
    while True:
        json_recieved = in_queue.get()
        if last_blob == json_recieved:
            continue  # don't double fire
        last_blob = json_recieved
        if "Deck.GetDeckLists" in json_recieved:
            print("looks like you just saved your decks. Here they are...")
            for deck in json_recieved["Deck.GetDeckLists"]:
                process_deck(deck)
            print("--------------------")
        else:
            print("unknown blob: {}".format(json_recieved))
        if json_recieved is None:
            break


if __name__ == "__main__":
    block_watch_process = multiprocessing.Process(target=block_watch_task, args=(block_read_queue, json_blob_queue, ))
    block_watch_process.start()

    json_watch_process = multiprocessing.Process(target=json_blob_reader_task, args=(json_blob_queue, json_blob_queue, ))
    json_watch_process.start()

    current_block = ""
    for line in tailer.follow(open(output_log)):
        if line.strip() == "":
            block_read_queue.put(current_block)
            current_block = ""
        else:
            current_block += line + "\n"
