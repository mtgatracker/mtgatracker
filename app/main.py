import sys
import os

path_to_root = os.path.abspath(os.path.join(__file__, "..", ".."))
sys.path.append(path_to_root)

import threading
import argparse
import logging
from app import tasks, queues
from util import KillableTailer
import asyncio
import datetime
import json
import websockets
import time
from app.queues import all_die_queue
from app.mtga_app import mtga_watch_app


now = datetime.datetime.now()
access_log_file = "access_log-{}_{}_{}-{}_{}_{}.log".format(now.month, now.day, now.year, now.hour, now.minute, now.second)
file_handler = logging.FileHandler(access_log_file)
log = logging.getLogger('werkzeug')
log.setLevel(logging.INFO)
log.addHandler(file_handler)

arg_parser = argparse.ArgumentParser()
arg_parser.add_argument('-i', '--log_file', default=None)
arg_parser.add_argument('-nf', '--no_follow', action="store_true", default=False)
arg_parser.add_argument('-f', '--read_full_log', action="store_true", default=False)
arg_parser.add_argument('-p', '--port', default=8089, type=int)
args = arg_parser.parse_args()


async def stats(websocket):
    send = False
    info = {}
    if mtga_watch_app.game:
        with mtga_watch_app.game_lock:
            stats = mtga_watch_app.game.hero.calculate_draw_odds(mtga_watch_app.game.ignored_iids)
            if stats["hash"] != mtga_watch_app.game.last_odds_hash:
                send = True
                mtga_watch_app.game.last_odds_hash = stats['hash']
            info.update(stats)
    else:
        info["sorry"] = "no game yet"
    # info["last_blob"] = mtga_watch_app.last_blob
    now = datetime.datetime.utcnow().isoformat() + 'Z'
    info["now"] = now
    if send:
        await websocket.send(json.dumps(info))
    await asyncio.sleep(0.1)


async def consumer_handler(websocket):
    async for message in websocket:
        if message == "die":
            all_die_queue.put("DIE")
        await websocket.send("ack {}".format(message))


async def handler(websocket, _):
    while all_die_queue.empty():
        consumer_task = asyncio.ensure_future(consumer_handler(websocket))
        producer_task = asyncio.ensure_future(stats(websocket))
        done, pending = await asyncio.wait(
            [consumer_task, producer_task],
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task in pending:
            task.cancel()
        time.sleep(1)

if args.log_file is None:  # assume we're on windows for now # TODO
    appdata_roaming = os.getenv("APPDATA")
    wotc_locallow_path = os.path.join(appdata_roaming, "..", "LocalLow", "Wizards Of The Coast", "MTGA")
    output_log = os.path.join(wotc_locallow_path, "output_log.txt")
    args.log_file = output_log

if __name__ == "__main__":

    block_watch_process = threading.Thread(target=tasks.block_watch_task, args=(queues.block_read_queue, queues.json_blob_queue, ))
    block_watch_process.start()

    json_watch_process = threading.Thread(target=tasks.json_blob_reader_task, args=(queues.json_blob_queue, queues.json_blob_queue, ))
    json_watch_process.start()
    current_block = ""

    start_server = websockets.serve(handler, '127.0.0.1', 5678)
    asyncio.get_event_loop().run_until_complete(start_server)

    websocket_thread = threading.Thread(target=asyncio.get_event_loop().run_forever)
    websocket_thread.start()

    if args.read_full_log:
        with open(args.log_file, 'r') as rf:
            all_lines = rf.readlines()
            for idx, line in enumerate(all_lines):
                if line.strip() == "":
                    queues.block_read_queue.put(current_block)
                    current_block = ""
                else:
                    current_block += line.strip() + "\n"
                if not all_die_queue.empty():
                    break
    if not args.no_follow:
        with open(args.log_file) as log_file:
            kt = KillableTailer(log_file, queues.all_die_queue)
            kt.seek_end()
            for line in kt.follow(1):
                if line.strip() == "":
                    queues.block_read_queue.put(current_block)
                    current_block = ""
                else:
                    current_block += line.strip() + "\n"
                if not all_die_queue.empty():
                    break
    queues.block_read_queue.put(None)
    block_watch_process.join()
    json_watch_process.join()
    loop = asyncio.get_event_loop()
    loop.stop()
    websocket_thread.join()