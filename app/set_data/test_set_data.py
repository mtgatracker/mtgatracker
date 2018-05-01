import time
import os
import sys
sys.path.append(os.path.join("..", ".."))
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
from app.models import set
from util import KillableTailer
from queue import Queue, Empty
from util import all_mtga_cards, dom


takeover_q = Queue()
all_done_q = Queue()

log_deck_result_queue = Queue()

mouse = Controller()
keyboard = KeyboardController()

HOME_LOCATION = 380, 30
DECKS_LOCATION = 500, 30
PACKS_LOCATION = 630, 30
STORE_LOCATION = 750, 30

EDIT_DECK = 1731, 1000
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

ONLY_ONE_DECK_LOC = 534, 278

WAIT_SHORT = 0.7
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
            print(json_recieved)
            for deck in decks:
                if deck.pool_name == "Imported Deck":
                    log_deck_result_queue.put(deck.cards)
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


#
# set_card_counts = {}
# visited_dualside_cards = []
# dual_sided = {}
# #
# for card in all_mtga_cards.cards:
#     card_key = card.set + str(card.set_number)
#     set_card_counts[card_key] = set_card_counts.get(card_key, []) + [card]

# for card_key in set_card_counts.keys():
#     if len(set_card_counts[card_key]) == 2:
#         dual_sided[card_key] = set_card_counts[card_key]
#
# failed_round1 = []
# with open("set_data_test_results/failed_pass2_round1.txt", 'r') as rf:
#     lines = rf.readlines()
#     for line in lines:
#         line = line.strip()
#         if not line:
#             continue
#         line = line.replace("--", "-")
#         name, set, set_id = line.split("-")
#         failed_round1.append((set, set_id))
#
#
dc = set.Pool.from_sets("dom_cards", sets=[dom.Dominaria])
cards_to_test = []
for card in dc.cards:
    card_key = card.set + str(card.set_number)
    card_import_string = "1 {} ({}) {}".format(card.pretty_name, "DAR", card.set_number)
    cards = [card]
    cards_to_test.append((card_import_string, cards))

# cards_to_test = cards_to_test[:3]


@pytest.mark.parametrize("import_string,card_models", cards_to_test, ids=[str(c) for c in cards_to_test])
def test_card(log_watch_thread, mouse_listener_thread, import_string, card_models):
    import_log_and_delete_deck(import_string)
    start_dt = datetime.datetime.now()
    decks = []
    while (datetime.datetime.now() - start_dt).total_seconds() < 3 and len(decks) < 2:
        try:
            decks.append(log_deck_result_queue.get(timeout=0.1))
        except Empty:
            pass
    if "///" in import_string and not decks:  # maybe we got flip order backwards
        import_string_split = import_string.split(" ")
        # ["1", "Believe", "///", "Reason", ...]
        import_string_split[1], import_string_split[3] = import_string_split[3], import_string_split[1]
        flipped_import_string = " ".join(import_string_split)
        import_log_and_delete_deck(flipped_import_string)
        start_dt = datetime.datetime.now()
        decks = []
        while (datetime.datetime.now() - start_dt).total_seconds() < 3 and len(decks) < 2:
            try:
                decks.append(log_deck_result_queue.get(timeout=0.1))
            except Empty:
                pass
    assert decks, "no deck showed up in the logs"
    for deck in decks:
        assert deck, "deck {} showed up empty (tried to import `{}`)".format(deck, import_string)
        for card in deck:
            assert card.mtga_id in [c.mtga_id for c in card_models], "id's didn't match: expected to be in ({}), got ({}, {})".format(card_models, card.pretty_name, card.mtga_id)
            assert card.pretty_name in [c.pretty_name for c in card_models], "names didn't match:  expected to be in ({}), got ({}, {})".format(card_models, card.pretty_name, card.mtga_id)


def import_log_and_delete_deck(deck_text):
    pyperclip.copy(deck_text)
    speedy_click(*IMPORT_DECK)
    spiffy_click(*IMPORT_DECK_OK)
    # speedy_click(*HOME_LOCATION)
    # time.sleep(1)
    # slow_click(*DECKS_LOCATION)
    speedy_click(*ONLY_ONE_DECK_LOC)
    speedy_click(*DELETE_DECK)
    spiffy_click(*DELETE_DECK_OK)

    # may need to delete deck more than once if for some reason extra decks get generated
    speedy_click(*ONLY_ONE_DECK_LOC)
    speedy_click(*DELETE_DECK)
    spiffy_click(*DELETE_DECK_OK)


def speedy_click(x, y):
    wait = 1
    sleeptime = 0.0
    while wait:
        try:
            wait = takeover_q.get_nowait()
        except Empty:
            wait = None
        if wait:
            if sleeptime < 1:
                sleeptime += 0.1
                time.sleep(0.1)
            else:
                sleeptime -= 0.1
    time.sleep(WAIT_SHORT / 8)
    mouse.position = x, y
    time.sleep(WAIT_SHORT / 8)
    mouse.press(Button.left)
    time.sleep(WAIT_SHORT / 8)
    mouse.release(Button.left)
    time.sleep(WAIT_SHORT / 8)


def spiffy_click(x, y):
    wait = 1
    sleeptime = 0.0
    while wait:
        try:
            wait = takeover_q.get_nowait()
        except Empty:
            wait = None
        if wait:
            print("taking over? waiting {} more seconds".format(takeover_q.qsize() / 100))
            if sleeptime < 1:
                sleeptime += 0.1
                time.sleep(0.1)
            else:
                sleeptime -= 0.1
    time.sleep(WAIT_SHORT / 4)
    mouse.position = x, y
    time.sleep(WAIT_SHORT / 2)
    mouse.press(Button.left)
    time.sleep(WAIT_SHORT / 2)
    mouse.release(Button.left)
    time.sleep(WAIT_SHORT / 4)


def slow_click(x, y):
    wait = 1
    sleeptime = 0.0
    while wait:
        try:
            wait = takeover_q.get_nowait()
        except Empty:
            wait = None
        if wait:
            print("taking over? waiting {} more seconds".format(takeover_q.qsize() / 100))
            if sleeptime < 1:
                sleeptime += 0.1
                time.sleep(0.1)
            else:
                sleeptime -= 0.1
    time.sleep(WAIT_SHORT / 2)
    mouse.position = x, y
    time.sleep(WAIT_SHORT / 2)
    mouse.press(Button.left)
    time.sleep(WAIT_SHORT)
    mouse.release(Button.left)
    time.sleep(WAIT_SHORT / 2)


def backup_all_decks():
    lw = log_watch_thread()
    ml = mouse_listener_thread()
    for xpos in list(DECKS_COLUMN_XPOS[:1]):
        for ypos in list(DECKS_ROW_YPOS[:1]):
            if (xpos, ypos) == (DECKS_COLUMN_XPOS[0], DECKS_ROW_YPOS[0]):
                continue
            spiffy_click(xpos, ypos)
            spiffy_click(*EXPORT_DECK)
            deck_contents = pyperclip.paste()
            spiffy_click(*EXPORT_OK)
            spiffy_click(*EDIT_DECK)
            time.sleep(WAIT_LONG)
            spiffy_click(*DECK_EDIT_NAME)
            time.sleep(WAIT_SHORT)
            keyboard.press(Key.ctrl_l)
            keyboard.press('c')
            keyboard.release('c')
            keyboard.release(Key.ctrl_l)
            time.sleep(WAIT_SHORT)
            deck_name = pyperclip.paste()
            spiffy_click(*DECK_EDIT_DONE)
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


def watch_mouse():
    with Listener(on_move=on_move) as listener:
        listener.join()


if __name__ == '__main__':
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! WARNING !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! WARNING !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    print("!!!!!!!!!!!!!!!!  Do not attempt to run these tests on any screen size besides 1920x1080   !!!!!!!!!!!!!!!!")
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! WARNING !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! WARNING !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    print("!!")
    print("!!  You should back up and remove ALL of your decks before continuing.")
    print("!!  This script requires that the first deck slot be available, and will repeatedly delete the first")
    print("!!    saved deck. If you do not want your decks to be deleted, back out now!")
    print("!!  In any mode chosen, this script will takeover your mouse and perform many clicks.")
    print("!!  MTGA must be running and fullscreen 1920x1080 on your right-most monitor, on the decks page.")
    print("!! It may take upwards of 3 hours to perform a full test suite.")
    print("!! please type 'OK' to continue, 'backup' to perform a deck backup, or anything else to exit.")
    ok = input("[OK/backup/exit]: ")
    if ok == "OK":
        for i in range(3, 0, -1):
            print("starting in {}".format(i))
            time.sleep(1)
        pytest.main(['--html=set_data_report.html'])
    elif ok == "backup":
        for i in range(3, 0, -1):
            print("starting in {}".format(i))
            time.sleep(1)
        backup_all_decks()
        print("done, exiting")
    else:
        print("exiting.")
