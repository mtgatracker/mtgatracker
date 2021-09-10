import sys
import os

path_to_root = os.path.abspath(os.path.join(__file__, "..", ".."))
sys.path.append(path_to_root)

import threading
import argparse
from app import tasks, queues
from util import KillableTailer
from queue import Empty
import asyncio
import datetime
import json
import websockets
import websockets.legacy
import websockets.legacy.server
import time
from pynput import mouse
from app.queues import all_die_queue, game_state_change_queue, general_output_queue, decklist_change_queue
import psutil
from tkinter import Tk, messagebox

arg_parser = argparse.ArgumentParser()
arg_parser.add_argument('-i', '--log_file', default=None)
arg_parser.add_argument('-nf', '--no_follow', action="store_true", default=False)
arg_parser.add_argument('-f', '--read_full_log', action="store_true", default=False)
arg_parser.add_argument('-m', '--mouse_events', action="store_true", default=False)
arg_parser.add_argument('-p', '--port', default=8089, type=int)
args = arg_parser.parse_args()

print("process started with args: {}".format(args))

async def stats(websocket):
    try:
        game_state = game_state_change_queue.get(timeout=0.01)
    except Empty:
        game_state = False
    if game_state:
        now = datetime.datetime.utcnow().isoformat() + 'Z'
        game_state["now"] = now
        game_state["data_type"] = "game_state"
        await websocket.send(json.dumps(game_state))
    # else:
    #     await websocket.send('{"no": "data"}')
    await asyncio.sleep(0.01)


async def decks(websocket):
    decklist_change = {}
    try:
        decks = decklist_change_queue.get(timeout=0.01)
    except Empty:
        decks = False
    if decks:
        decklist_change["decks"] = decks
        now = datetime.datetime.utcnow().isoformat() + 'Z'
        decklist_change["now"] = now
        decklist_change["data_type"] = "decklist_change"
        await websocket.send(json.dumps(decklist_change))
    await asyncio.sleep(0.01)


async def output(websocket):
    try:
        message = general_output_queue.get(timeout=0.01)
    except Empty:
        message = False
    if message:
        now = datetime.datetime.utcnow().isoformat() + 'Z'
        message['now'] = now
        if isinstance(message, dict) and "error" in message.keys():
            message["data_type"] = "error"
        else:
            message["data_type"] = "message"
        message_to_send = json.dumps(message)
        await websocket.send(message_to_send)
    await asyncio.sleep(0.01)


async def consumer_handler(websocket):
    async for message in websocket:
        if message == "die":
            all_die_queue.put("DIE")
        else:
            print("ack {}".format(message))
        await websocket.send("ack {}".format(message))


async def handler(websocket, _):
    while all_die_queue.empty():
        consumer_task = asyncio.ensure_future(consumer_handler(websocket))
        stats_task = asyncio.ensure_future(stats(websocket))
        output_task = asyncio.ensure_future(output(websocket))
        decks_task = asyncio.ensure_future(decks(websocket))
        done, pending = await asyncio.wait(
            [decks_task, consumer_task, stats_task, output_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for task in pending:
            task.cancel()
        time.sleep(0.1)
    websocket.close()
    loop = asyncio.get_event_loop()
    loop.stop()

if args.log_file is None:  # assume we're on windows for now # TODO
    appdata_roaming = os.getenv("APPDATA")
    wotc_locallow_path = os.path.join(appdata_roaming, "..", "LocalLow", "Wizards Of The Coast", "MTGA")
    output_log = os.path.join(wotc_locallow_path, "Player.log")
    if not os.path.exists(output_log):
        output_log = None
    args.log_file = output_log


def click_event(_x, _y, button, pressed):
    if pressed:
        if button == mouse.Button.right:
            general_output_queue.put({"right_click": True})
        if button == mouse.Button.left:
            general_output_queue.put({"left_click": True})
    if not all_die_queue.empty():
        return False


def start_mouse_listener():
    with mouse.Listener(on_click=click_event) as listener:
        listener.join()


if __name__ == "__main__":
    print("MTGA.exe running check")
    mtga_running = False
    while not mtga_running:
        for proc in psutil.process_iter():
            try:
                if proc.exe().endswith("MTGA.exe"):
                    mtga_running = True
                    break
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
        if not mtga_running:
            root = Tk()
            root.withdraw()
            ans = messagebox.askyesno(__file__, "MTG Arenaが起動していない可能性があります。\nはい: 再試行\nいいえ: 無視して続行")
            if ans == True:
                pass
            elif ans == False:
                mtga_running = True

    print("starting websocket server with port {}".format(args.port))
    start_server = websockets.serve(handler, '127.0.0.1', args.port)
    asyncio.get_event_loop().run_until_complete(start_server)

    print("starting block watch task server")
    block_watch_process = threading.Thread(target=tasks.block_watch_task, args=(queues.block_read_queue, queues.json_blob_queue, ))
    block_watch_process.start()

    print("starting json watch task server")
    json_watch_process = threading.Thread(target=tasks.json_blob_reader_task, args=(queues.json_blob_queue, queues.json_blob_queue, ))
    json_watch_process.start()
    current_block = ""

    print("starting websocket thread")
    websocket_thread = threading.Thread(target=asyncio.get_event_loop().run_forever)
    websocket_thread.start()

    print("starting mouse thread")
    mouse_thread = None
    if args.mouse_events:
        mouse_thread = threading.Thread(target=start_mouse_listener)
        mouse_thread.start()

    if args.read_full_log:
        print("WARNING: known issue with reading full log!")
        print("For some reason, reading the full log causes the python process to never exit.")
        print("It has something to do with putting data into the queue from this block (line marked), but other than")
        print("that I really can't figure it out. Anyways, you'll have to kill the python process manually.")
        with open(args.log_file, 'r', encoding="utf_8_sig") as rf:
            in_uctl = False
            in_json = False
            is_resp = False
            for idx, line in enumerate(rf):
                if line:
                    if not in_json:
                        if in_uctl:
                            if line.rstrip() == "{" or line.rstrip() == "[":   # start of JSON string
                                in_json = True
                                current_block += line.strip() + "\n"
                            elif (line.strip().startswith("{") and line.strip().endswith("}")
                                or line.strip().startswith("[") and line.strip().endswith("]")
                                or line.strip().startswith("\"") and line.strip().endswith("\"")):  # JSON string line
                                current_block += line.strip() + "\n"
                                in_uctl = False
                            elif line.strip().startswith("<== "):   # is response
                                current_block += line.strip() + "\n"
                                is_resp = True
                            elif line.strip().startswith("("):   # sessionId
                                current_block += line.strip() + "\n"
                                in_uctl = False
                            elif is_resp:   # response value
                                current_block += line.strip() + "\n"
                                in_uctl = False
                        else:
                            if len(current_block) > 0:  # put curernt_block
                                queues.block_read_queue.put((idx, current_block))
                                current_block = ""
                                in_uctl = False
                            if line.strip().startswith("[UnityCrossThreadLogger]"):
                                current_block = line.strip() + "\n"
                                if not (line.strip().endswith("}") or line.strip().endswith("]")):  # no JSON string in line, so continue to read line
                                    in_uctl = True
                                if line.strip().endswith("{") or line.strip().endswith("["):    # start of JSON string in line
                                    in_json = True
                    elif in_uctl and in_json:
                        current_block += line.strip() + "\n"
                        if line.rstrip() == "}" or line.rstrip() == "]":    # end of JSON string
                            in_uctl = False
                            in_json = False
                if not all_die_queue.empty():
                    break
    count = 0
    if not args.no_follow and all_die_queue.empty():
        print("starting to tail file: {}".format(args.log_file))
        if args.log_file:
            with open(args.log_file, encoding="utf_8_sig") as log_file:
                kt = KillableTailer(log_file, queues.all_die_queue)
                kt.seek_end()
                in_uctl = False
                in_json = False
                is_resp = False
                for line in kt.follow(1):
                    if line:
                        if not in_json:
                            if in_uctl:
                                if line.rstrip() == "{" or line.rstrip() == "[":   # start of JSON string
                                    in_json = True
                                    current_block += line.strip() + "\n"
                                elif (line.strip().startswith("{") and line.strip().endswith("}")
                                    or line.strip().startswith("[") and line.strip().endswith("]")):
                                    current_block += line.strip() + "\n"
                                    in_uctl = False
                                elif line.strip().startswith("<== "):   # is response
                                    current_block += line.strip() + "\n"
                                    is_resp = True
                                elif line.strip().startswith("("):   # sessionId
                                    current_block += line.strip() + "\n"
                                    in_uctl = False
                                elif is_resp:   # response value
                                    current_block += line.strip() + "\n"
                                    in_uctl = False
                            else:
                                if len(current_block) > 0:  # put curernt_block
                                    queues.block_read_queue.put(current_block)
                                    current_block = ""
                                    in_uctl = False
                                if line.strip().startswith("[UnityCrossThreadLogger]"):
                                    current_block = line.strip() + "\n"
                                    if not (line.strip().endswith("}") or line.strip().endswith("]")):  # no JSON string in line, so continue to read line
                                        in_uctl = True
                                    if line.strip().endswith("{") or line.strip().endswith("["):    # start of JSON string in line (never appear)
                                        in_json = True
                        elif in_uctl and in_json:
                            current_block += line.strip() + "\n"
                            if line.rstrip() == "}" or line.rstrip() == "]":    # end of JSON string
                                in_uctl = False
                                in_json = False
                    if not all_die_queue.empty():
                        break
        else:
            general_output_queue.put({"error": "NoLogException", "msg": "No log file present. Please run MTGA at least once before launching MTGA Tracker.", "count": 1})

    queues.block_read_queue.put(None)

    block_watch_process.join()
    json_watch_process.join()
    websocket_thread.join()
    start_server.ws_server.close()
    if mouse_thread:
        mouse_thread.join()
        print("mouse joined!")
    while queues.json_blob_queue.qsize():
        queues.json_blob_queue.get()