""" util.py

generally stuff that is useful but just hasn't quite found a home elswhere in the project yet. Anything here is subject
to being moved at random! """

import os
from models.set import Pool
from set_data.rix import RivalsOfIxalan
from set_data.weird import WeirdLands
from set_data.xln import Ixalan

appdata_roaming = os.getenv("APPDATA")
wotc_locallow_path = os.path.join(appdata_roaming, "..", "LocalLow", "Wizards Of The Coast", "MTGA")
output_log = os.path.join(wotc_locallow_path, "output_log.txt")

my_documents_log_path = os.path.join(os.path.expanduser("~"), "Documents", "MTGA", "Logs")
my_documents_logs = os.listdir(my_documents_log_path)

all_mtga_cards = Pool.from_sets("mtga_cards", sets=[RivalsOfIxalan, Ixalan, WeirdLands])

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


def process_deck(deck_dict):
    deck_pool = Pool(deck_dict["name"])
    for card_obj in deck_dict["mainDeck"]:
        try:
            card = all_mtga_cards.search(card_obj["id"])[0]
            for i in range(card_obj["quantity"]):
                deck_pool.cards.append(card)
        except:
            print("NOOO cant find {} in all_mtga_cards".format(card_obj))
            raise
    return deck_pool


def print_deck(deck_pool):
    print("Deck: {} ({} cards)".format(deck_pool.pool_name, len(deck_pool.cards)))
    grouped = deck_pool.group_cards()
    for card in grouped.keys():
        print("  {}x {}".format(grouped[card], card))