import sys
import os
from queue import Empty

path_to_root = os.path.abspath(os.path.join(__file__, "..", ".."))
sys.path.append(path_to_root)

import threading
import argparse
from app import tasks, queues
from util import KillableTailer
import asyncio
import datetime
import json
import websockets
import time

from app.queues import all_die_queue, game_state_change_queue, general_output_queue

arg_parser = argparse.ArgumentParser()
arg_parser.add_argument('-i', '--log_file', default=None)
arg_parser.add_argument('-nf', '--no_follow', action="store_true", default=False)
arg_parser.add_argument('-f', '--read_full_log', action="store_true", default=False)
arg_parser.add_argument('-p', '--port', default=8089, type=int)
args = arg_parser.parse_args()


async def stats(websocket):
    try:
        game_state = game_state_change_queue.get(timeout=0.1)
    except Empty:
        game_state = False
    if game_state:
        now = datetime.datetime.utcnow().isoformat() + 'Z'
        game_state["now"] = now
        game_state["data_type"] = "game_state"
        await websocket.send(json.dumps(game_state))
    await asyncio.sleep(0.5)


async def output(websocket):
    try:
        message = general_output_queue.get(timeout=0.1)
    except Empty:
        message = False
    if message:
        now = datetime.datetime.utcnow().isoformat() + 'Z'
        message['now'] = now
        message["data_type"] = "message"
        await websocket.send(json.dumps(message))
    await asyncio.sleep(0.5)


async def consumer_handler(websocket):
    async for message in websocket:
        if message == "die":
            all_die_queue.put("DIE")
        await websocket.send("ack {}".format(message))


async def handler(websocket, _):
    while all_die_queue.empty():
        consumer_task = asyncio.ensure_future(consumer_handler(websocket))
        stats_task = asyncio.ensure_future(stats(websocket))
        output_task = asyncio.ensure_future(output(websocket))
        done, pending = await asyncio.wait(
            [consumer_task, stats_task, output_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
        time.sleep(1)
    websocket.close()
    loop = asyncio.get_event_loop()
    loop.stop()

if args.log_file is None:  # assume we're on windows for now # TODO

    appdata_roaming = os.getenv("APPDATA")
    wotc_locallow_path = os.path.join(appdata_roaming, "..", "LocalLow", "Wizards Of The Coast", "MTGA")
    output_log = os.path.join(wotc_locallow_path, "output_log.txt")
    args.log_file = output_log

if __name__ == "__main__":

    start_server = websockets.serve(handler, '127.0.0.1', 5678)
    asyncio.get_event_loop().run_until_complete(start_server)

    block_watch_process = threading.Thread(target=tasks.block_watch_task, args=(queues.block_read_queue, queues.json_blob_queue, ))
    block_watch_process.start()

    json_watch_process = threading.Thread(target=tasks.json_blob_reader_task, args=(queues.json_blob_queue, queues.json_blob_queue, ))
    json_watch_process.start()
    current_block = ""

    websocket_thread = threading.Thread(target=asyncio.get_event_loop().run_forever)
    websocket_thread.start()

    if args.read_full_log:
        print("WARNING: known issue with reading full log!")
        print("For some reason, reading the full log causes the python process to never exit.")
        print("It has something to do with putting data into the queue from this block (line marked), but other than")
        print("that I really can't figure it out. Anyways, you'll have to kill the python process manually.")
        with open(args.log_file, 'r') as rf:
            for idx, line in enumerate(rf):
                if line.strip() == "":
                    queues.block_read_queue.put(current_block)  # THIS IS THE BAD LINE :(
                    current_block = ""
                else:
                    current_block += line.strip() + "\n"
                if not all_die_queue.empty():
                    break
    if not args.no_follow and all_die_queue.empty():
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
    websocket_thread.join()
    start_server.ws_server.close()
