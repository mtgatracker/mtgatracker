import threading
import time
import os

import datetime
import pytest
from pynput.mouse import Controller, Button, Listener
from pynput.keyboard import Key, Controller as KeyboardController
import pyperclip
import pprint
import threading
from app import parsers
from app import tasks
from app import queues
from util import KillableTailer
from queue import Queue, Empty
from util import all_mtga_cards


@pytest.mark.optionalhook
def pytest_html_results_table_row(report, cells):
    if report.passed:
      del cells[:]


takeover_q = Queue()
all_done_q = Queue()

log_deck_result_queue = Queue()

mouse = Controller()
keyboard = KeyboardController()

HOME_LOCATION = 380, 30
DECKS_LOCATION = 500, 30
PACKS_LOCATION = 630, 30
STORE_LOCATION = 750, 30

EDIT_DECK = 186, 1004
IMPORT_DECK = 431, 1013
EXPORT_DECK = 621, 1008
EXPORT_OK = 974, 644
DELETE_DECK = 1015, 1008
DELETE_DECK_OK = 1222, 644

DECK_EDIT_DONE = 1596, 1009
DECK_EDIT_NAME = 1772, 155

IMPORT_DECK_OK = 953, 647

DECKS_ROW_YPOS = 275, 515, 740
DECKS_COLUMN_XPOS = 245, 530, 830, 1130, 1430,  1700

ONLY_ONE_DECK_LOC = 1106, 272

WAIT_SHORT = 0.5
WAIT_LONG = 2


def watch_for_cards(in_queue, out_queue):
    last_blob = None
    while all_done_q.empty():
        json_recieved = in_queue.get()

        if json_recieved is None:
            out_queue.put(None)
            break

        if last_blob == json_recieved:
            continue  # don't double fire
        if "Deck.GetDeckLists" in json_recieved:  # this looks like it's a response to a jsonrpc method
            decks = parsers.parse_get_decklists(json_recieved)
            for deck in decks:
                if deck.pool_name == "Imported Deck":
                    log_deck_result_queue.put(deck.cards)
                    pprint.pprint(deck.cards)
    print("watch_for_cards task finished")


def watch_log_lines():
    current_block = ""
    print("enter log parsing")
    log_file_path = r'C:\Users\Spencatro\AppData\LocalLow\Wizards Of The Coast\MTGA\output_log.txt'
    with open(log_file_path) as log_file:
        kt = KillableTailer(log_file, all_done_q)
        kt.seek_end()
        for line in kt.follow(1):
            if line.strip() == "":
                if "{" in current_block:  # try to speed up debug runs by freeing up json watcher task
                                          # which is likely the slowest
                    queues.block_read_queue.put(current_block)
                current_block = ""
            else:
                current_block += line.strip() + "\n"
            if not all_done_q.empty():
                break
    print("watch_log_lines done")


@pytest.fixture(scope='module')
def mouse_listener_thread():
    print("starting watch task")
    watch_task = threading.Thread(target=watch_mouse)
    watch_task.start()
    yield watch_task
    all_done_q.put("Done")
    watch_task.join()
    print("watch task finished")


@pytest.fixture(scope='module')
def log_watch_thread():
    block_watch_process = threading.Thread(target=tasks.block_watch_task, args=(queues.block_read_queue, queues.json_blob_queue, ))
    block_watch_process.start()

    json_watch_process = threading.Thread(target=watch_for_cards, args=(queues.json_blob_queue, queues.json_blob_queue, ))
    json_watch_process.start()

    line_watch_process = threading.Thread(target = watch_log_lines)
    line_watch_process.start()

    yield "ok"

    all_done_q.put("Done")
    queues.block_read_queue.put(None)
    block_watch_process.join()
    json_watch_process.join()
    while queues.json_blob_queue.qsize():
        queues.json_blob_queue.get()
    print("log_watch task finished")


failed_round1 = []
with open("failed_round1.txt", 'r') as rf:
    lines = rf.readlines()
    for line in lines:
        line = line.strip()
        if not line:
            continue
        line = line.replace("--", "-")
        name, set, set_id = line.split("-")
        failed_round1.append((name, set, set_id))


cards_to_test = [card for card in all_mtga_cards.cards if (card.name, card.set.upper(), str(card.set_number)) in failed_round1]


@pytest.mark.parametrize("card_model", cards_to_test, ids=["{}-{}-{}".format(c.name, c.set, c.set_number) for c in cards_to_test])
def test_card(log_watch_thread, mouse_listener_thread, card_model):
    print(type(card_model))
    print("testing card: {}".format(card_model.pretty_name))
    deck_text = "1 {} ({}) {}".format(card_model.pretty_name, card_model.set.upper(), card_model.set_number)
    print(deck_text)
    import_deck(deck_text)
    start_dt = datetime.datetime.now()
    decks = []
    while (datetime.datetime.now() - start_dt).total_seconds() < 10 and len(decks) < 2:
        try:
            decks.append(log_deck_result_queue.get(timeout=0.1))
        except Empty:
            pass
    assert decks, "no deck showed up in the logs"
    for deck in decks:
        for card in deck:
            assert card.mtga_id == card_model.mtga_id, "id's didn't match: expected ({}, {}), got ({}, {})".format(card_model.pretty_name, card_model.mtga_id, card.pretty_name, card.mtga_id)
            assert card.pretty_name == card_model.pretty_name, "names didn't match:  expected ({}, {}), got ({}, {})".format(card_model.pretty_name, card_model.mtga_id, card.pretty_name, card.mtga_id)


def import_deck(deck_text):
    pyperclip.copy(deck_text)
    slow_click(*DECKS_LOCATION)
    slow_click(*IMPORT_DECK)
    slow_click(*IMPORT_DECK_OK)
    slow_click(*ONLY_ONE_DECK_LOC)
    slow_click(*DELETE_DECK)
    slow_click(*DELETE_DECK_OK)


def slow_click(x, y):
    wait = 1
    while wait:
        try:
            wait = takeover_q.get_nowait()
        except Empty:
            wait = None
        if wait:
            print("taking over? waiting {} more seconds".format(takeover_q.qsize() / 100))
            time.sleep(0.1)
    time.sleep(WAIT_SHORT / 2)
    mouse.position = x, y
    time.sleep(WAIT_SHORT / 2)
    mouse.press(Button.left)
    time.sleep(WAIT_SHORT)
    mouse.release(Button.left)
    time.sleep(WAIT_SHORT / 2)


def backup_all_decks():
    for xpos in list(DECKS_COLUMN_XPOS):
        for ypos in list(DECKS_ROW_YPOS):
            if (xpos, ypos) == (DECKS_COLUMN_XPOS[0], DECKS_ROW_YPOS[0]):
                continue
            slow_click(xpos, ypos)
            slow_click(*EXPORT_DECK)
            deck_contents = pyperclip.paste()
            slow_click(*EXPORT_OK)
            slow_click(*EDIT_DECK)
            time.sleep(WAIT_LONG)
            slow_click(*DECK_EDIT_NAME)
            keyboard.press(Key.ctrl_l)
            keyboard.press('c')
            keyboard.release('c')
            keyboard.release(Key.ctrl_l)
            time.sleep(WAIT_SHORT)
            deck_name = pyperclip.paste()
            slow_click(*DECK_EDIT_DONE)
            deck_name = deck_name.replace(" ", "_")
            deck_name = ''.join(ch for ch in deck_name if ch.isalnum() or ch == "_")
            print("backed up {}".format(deck_name))
            deck_path = os.path.join("deck_backups", "{}.txt".format(deck_name))
            with open(deck_path, 'w') as wfp:
                wfp.write(deck_contents)
            time.sleep(WAIT_SHORT)


def on_move(x, y):
    takeover_q.put((x,y))
    if all_done_q.qsize():
        return False


for i in range(3, 0, -1):
    print("starting in {}".format(i))
    time.sleep(1)


def watch_mouse():
    with Listener(on_move=on_move) as listener:
        listener.join()


# backup_all_decks()



# 1 Ambuscade (HOU) 110 = 65767
# 1 Pride Sovereign (HOU) 126
# 1 Sifter Wurm (HOU) 135
# 1 Bloodwater Entity (HOU) 138
# 1 The Locust God (HOU) 139
# 1 Nicol Bolas, God-Pharaoh (HOU) 140
# 1 Obelisk Spider (HOU) 141
# 1 Resolute Survivors (HOU) 142 65761
# 1 River Hoopoe (HOU) 143
# 1 Samut, the Tested (HOU) 144 = 65767
# 1 The Scarab God (HOU) 145 = 65769
# 1 The Scorpion God (HOU) 146
# 1 Unraveling Mummy (HOU) 147
