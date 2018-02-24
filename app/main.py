import sys, os
import requests


path_to_root = os.path.abspath(os.path.join(__file__, "..", ".."))
print(path_to_root)
sys.path.append(path_to_root)

import threading
import functools
import argparse
import logging
from app import tasks, queues
from util import KillableTailer

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

arg_parser = argparse.ArgumentParser()
arg_parser.add_argument('-i', '--log_file', default=None)
arg_parser.add_argument('-nf', '--no_follow', action="store_true", default=False)
arg_parser.add_argument('-f', '--read_full_log', action="store_true", default=False)
arg_parser.add_argument('-p', '--port', default=8089, type=int)
args = arg_parser.parse_args()

if args.log_file is None:  # assume we're on windows for now # TODO
    appdata_roaming = os.getenv("APPDATA")
    wotc_locallow_path = os.path.join(appdata_roaming, "..", "LocalLow", "Wizards Of The Coast", "MTGA")
    output_log = os.path.join(wotc_locallow_path, "output_log.txt")
    args.log_file = output_log

if __name__ == "__main__":

    block_watch_process = threading.Thread(target=tasks.block_watch_task, args=(queues.block_read_queue, queues.json_blob_queue, ))
    block_watch_process.start()

    from app.flask_app import http_app
    partial = functools.partial(http_app.run, port=args.port)
    flask_thread = threading.Thread(target=partial)
    flask_thread.start()
    print("running")

    json_watch_process = threading.Thread(target=tasks.json_blob_reader_task, args=(queues.json_blob_queue, queues.json_blob_queue, ))
    json_watch_process.start()
    current_block = ""

    if args.read_full_log:
        with open(args.log_file, 'r') as rf:
            all_lines = rf.readlines()
            for idx, line in enumerate(all_lines):
                if line.strip() == "":
                    queues.block_read_queue.put(current_block)
                    current_block = ""
                else:
                    current_block += line.strip() + "\n"

    if not args.no_follow:
        with open(args.log_file) as log_file:
            kt = KillableTailer(log_file, queues.all_die_queue)
            for line in kt.follow(log_file):
                if line.strip() == "":
                    queues.block_read_queue.put(current_block)
                    current_block = ""
                else:
                    current_block += line.strip() + "\n"
    queues.block_read_queue.put(None)
    block_watch_process.join()
    json_watch_process.join()
    if queues.all_die_queue.empty():  # we got here naturally, so we should kill the flask server
        requests.get("http://localhost:8080/die")