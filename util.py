""" util.py

generally stuff that is useful but just hasn't quite found a home elswhere in the project yet. Anything here is subject
to being moved at random! """
import pprint
import time

import models.set as set
import set_data.xln as xln
import set_data.rix as rix
import set_data.weird as weird
from tailer import Tailer

all_mtga_cards = set.Pool.from_sets("mtga_cards", sets=[rix.RivalsOfIxalan, xln.Ixalan, weird.WeirdLands])

example_deck = {
    'id': '32e22460-c165-48a3-881a-b6fad5d963b0',
    'name': 'The sky says SKREEAAA',
    'description': None,
    'format': None,
    'resourceId': '6f7b76fc-c988-4a35-b7cf-f5932c609571',
    'deckTileId': 66235,
    'mainDeck': [
        {'id': '66235', 'quantity': 1},
        {'id': '67021', 'quantity': 8},
        {'id': '66395', 'quantity': 1},
        {'id': '67023', 'quantity': 16},
        {'id': '66375', 'quantity': 2},
        {'id': '66335', 'quantity': 2},
        {'id': '66817', 'quantity': 1},
        {'id': '66273', 'quantity': 1},
        {'id': '66905', 'quantity': 1},
        {'id': '66423', 'quantity': 1},
        {'id': '66329', 'quantity': 3},
        {'id': '66893', 'quantity': 2},
        {'id': '66271', 'quantity': 2},
        {'id': '66347', 'quantity': 2},
        {'id': '66421', 'quantity': 1},
        {'id': '66853', 'quantity': 2},
        {'id': '66275', 'quantity': 2},
        {'id': '66825', 'quantity': 4},
        {'id': '66241', 'quantity': 2},
        {'id': '66915', 'quantity': 1},
        {'id': '66371', 'quantity': 2},
        {'id': '66341', 'quantity': 2},
        {'id': '66303', 'quantity': 1}
    ],
    'sideboard': [],
    'lockedForUse': False,
    'lockedForEdit': False,
    'isValid': True,
    'lastUpdated': '2018-02-11T00:24:40',
    'dataStoreVersion': None}


def card_ids_to_card_list(list_ids):
    return [id_to_card(card_id) for card_id in list_ids]


def id_to_card(card_id):
    # TODO: this is silly
        try:
            return all_mtga_cards.find_one(card_id)
        except:
            print("NOOO cant find {} in all_mtga_cards".format(card_id))
            raise


def process_deck(deck_dict):
    deck_id = deck_dict['id']
    deck = set.Deck(deck_dict["name"], deck_id)
    for card_obj in deck_dict["mainDeck"]:
        try:
            card = all_mtga_cards.search(card_obj["id"])[0]
            for i in range(card_obj["quantity"]):
                deck.cards.append(card)
        except:
            print("NOOO cant find {} in all_mtga_cards".format(card_obj))
            raise
    with mtga_app.mtga_watch_app.game_lock:
        mtga_app.mtga_watch_app.player_decks[deck_id] = deck
    return deck


def print_deck(deck_pool):
    print("Deck: {} ({} cards)".format(deck_pool.pool_name, len(deck_pool.cards)))
    grouped = deck_pool.group_cards()
    for card in grouped.keys():
        print("  {}x {}".format(grouped[card], card))


def deepsearch_blob_for_ids(blob, ids_only=True):
    full_res = {}
    if isinstance(blob, dict):
        for key in blob.keys():
            my_res = deepsearch_blob_for_ids(blob[key])
            for key in my_res:
                full_res[key] = my_res[key]
        return full_res
    elif isinstance(blob, list):
        for item in blob:
            my_res = deepsearch_blob_for_ids(item)
            for key in my_res:
                full_res[key] = my_res[key]
        return full_res
    else:
        search_res = all_mtga_cards.search(blob)
        is_number = False
        try:
            _unused_number = int(blob)
            is_number = True
        except (ValueError, TypeError):
            pass
        if search_res and blob and (not ids_only or is_number):
            return {blob: search_res}
        return {}


def dense_log(json_recieved):
    import app.mtga_app as mtga_app
    cards = deepsearch_blob_for_ids(json_recieved)
    with mtga_app.mtga_watch_app.game_lock:
        if cards:
            output = "{}\n{}\n{}".format(pprint.pformat(cards), "-" * 30, pprint.pformat(json_recieved))
            filename = "card"
            mtga_app.mtga_watch_app.make_logchunk_file(filename, output, False)


class KillableTailer(Tailer):

    def __init__(self, file, kill_queue):
        """ based on tailer.Tailer

        :param file: file to tail
        :param kill_queue: put anything in here to kill tailer
        """
        self.kill_queue = kill_queue
        super().__init__(file)

    def follow(self, delay=1.0):
        """\
        Iterator generator that returns lines as data is added to the file.

        Based on: http://aspn.activestate.com/ASPN/Cookbook/Python/Recipe/157035
        """
        trailing = True

        while self.kill_queue.empty():
            where = self.file.tell()
            line = self.file.readline()
            if line:
                if trailing and line in self.line_terminators:
                    # This is just the line terminator added to the end of the file
                    # before a new line, ignore.
                    trailing = False
                    continue

                if line[-1] in self.line_terminators:
                    line = line[:-1]
                    if line[-1:] == '\r\n' and '\r\n' in self.line_terminators:
                        # found crlf
                        line = line[:-1]

                trailing = False
                yield line
            else:
                trailing = True
                self.seek(where)
                time.sleep(delay)
        return


import app.mtga_app as mtga_app
