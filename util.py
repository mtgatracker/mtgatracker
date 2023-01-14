""" util.py

generally stuff that is useful but just hasn't quite found a home elswhere in the project yet. Anything here is subject
to being moved at random! """
import json
import os
import sys
import time
from tailer import Tailer

import app.models.set as set
from mtga.set_data import all_mtga_cards


depth = {"depth_counter": 0}


def ld(reset=False):
    if reset:
        depth["depth_counter"] = 0
    depth["depth_counter"] = max(depth["depth_counter"], 0)
    return "---" * depth["depth_counter"]


def debug_log_trace(decorated_function):
    import app.mtga_app as mtga_app
    from functools import wraps

    @wraps(decorated_function)
    def wrapper(*dec_fn_args, **dec_fn_kwargs):
        # Log function entry
        func_name = decorated_function.__name__
        mtga_app.mtga_logger.debug('{}Entering {}()...'.format(ld(), func_name))
        # Execute wrapped (decorated) function:
        depth["depth_counter"] += 1
        out = decorated_function(*dec_fn_args, **dec_fn_kwargs)
        depth["depth_counter"] -= 1
        mtga_app.mtga_logger.debug('{}Exiting {}()!'.format(ld(), func_name))

        return out
    return wrapper


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
    import app.mtga_app as mtga_app
    # TODO: this is silly
    try:
        return all_mtga_cards.find_one(card_id)
    except:
        mtga_app.mtga_logger.error("{}Unknown mtga_id: {}".format(ld(), card_id))
        mtga_app.mtga_watch_app.send_error("Unknown mtga_id: {}".format(card_id))


# TODO: this is ugly but I'm tired of precon's uglifying the tracker.
PRECON_MAP = {
    # initial single-color precons
    "?=?Loc/Decks/Precon/Precon_Red": "Dragon's Fire",
    "?=?Loc/Decks/Precon/Precon_Blue": "Arcane Inventions",
    "?=?Loc/Decks/Precon/Precon_Black": "Graveyard Bash",
    "?=?Loc/Decks/Precon/Precon_Green": "Forest's Might",
    "?=?Loc/Decks/Precon/Precon_White": "Tactical Assault",
    # guilds precons
    "?=?Loc/Decks/Precon/Precon_NPE_GRN_RG": "Primal Fury",
    "?=?Loc/Decks/Precon/Precon_NPE_GRN_UB": "Walk the Plank",
    "?=?Loc/Decks/Precon/Precon_NPE_GRN_UR": "Wrath of Mages",
    "?=?Loc/Decks/Precon/Precon_NPE_GRN_GW": "Auras of Majesty",
    "?=?Loc/Decks/Precon/Precon_NPE_GRN_WB": "Eternal Thirst",
    "?=?Loc/Decks/Precon/Precon_NPE_GRN_BR": "Chaos and Mayhem",
    "?=?Loc/Decks/Precon/Precon_NPE_GRN_BG": "Saproling Swarm",
    "?=?Loc/Decks/Precon/Precon_NPE_GRN_UG": "Jungle Secrets",
    "?=?Loc/Decks/Precon/Precon_NPE_GRN_RW": "Strength in Numbers",
    "?=?Loc/Decks/Precon/Precon_NPE_GRN_WU": "Artifacts Attack",
    # guilds replacement precon
    "?=?Loc/Decks/Precon/Precon_NPE_GRN_WU_2": "Wing and Claw",
    # twitch precon
    "?=?Loc/Decks/Precon/Precon_TwitchCon2018": "Selesnya Conclave",
    # brawl precons
    "?=?Loc/Decks/Precon/Precon_Brawl_SyrGwyn": "Knights' Charge",
    "?=?Loc/Decks/Precon/Precon_Brawl_Korvold": "Savage Hunter",
    "?=?Loc/Decks/Precon/Precon_Brawl_Chulane": "Wild Bounty",
    "?=?Loc/Decks/Precon/Precon_Brawl_Alela": "Faerie Schemes",
    # EPP decks
    "?=?Loc/Decks/Precon/Precon_EPP_BR": "Cult of Rakdos",
    "?=?Loc/Decks/Precon/Precon_EPP_BG": "Golgari Swarm",
    "?=?Loc/Decks/Precon/Precon_EPP_Black": "Out for Blood",
    "?=?Loc/Decks/Precon/Precon_EPP_Blue": "Azure Skies",
    "?=?Loc/Decks/Precon/Precon_EPP_Red": "Dome Destruction",
    "?=?Loc/Decks/Precon/Precon_EPP_GU": "Simic Combine",
    "?=?Loc/Decks/Precon/Precon_EPP_RG": "Gruul Clans",
    "?=?Loc/Decks/Precon/Precon_EPP_GW": "Selesneya Conclave",
    "?=?Loc/Decks/Precon/Precon_EPP_Green": "Forest's Might",
    "?=?Loc/Decks/Precon/Precon_EPP_RW": "Boros Legion",
    "?=?Loc/Decks/Precon/Precon_EPP_UR": "Izzet League",
    "?=?Loc/Decks/Precon/Precon_EPP_WB": "Orzhov Syndicate",
    "?=?Loc/Decks/Precon/Precon_EPP_WU": "Azorius Senate",
    "?=?Loc/Decks/Precon/Precon_EPP_UB": "House Dimir",
    "?=?Loc/Decks/Precon/Precon_EPP_White": "Angelic Army",
}


def process_deck(deck_summary_dict, deck_dict, save_deck=True, version=1):
    import app.mtga_app as mtga_app
    deck_id = deck_summary_dict.get("DeckId")
    if deck_summary_dict.get("name") in PRECON_MAP:
        deck_dict["name"] = PRECON_MAP[deck_summary_dict.get("name")]
    deck = set.Deck(deck_dict.get("name"), deck_id)

    process_func = _process_maindeck

    if version == 3:
        process_func = _process_maindeck_v3

    process_func(deck, deck_dict["MainDeck"])
    process_func(deck, deck_dict["Sideboard"], True)

    if save_deck:
        with mtga_app.mtga_watch_app.game_lock:
            mtga_app.mtga_watch_app.player_decks[deck_id] = deck
            mtga_app.mtga_logger.info("{}deck {} is being saved".format(ld(), deck_dict.get("name")))
            mtga_app.mtga_watch_app.save_settings()
    return deck


def _process_maindeck(deck, decklist_blob, is_sideboard=False):
    import app.mtga_app as mtga_app
    for card_obj in decklist_blob:
        try:
            id_key = "cardId"
            qt_key = "quantity"
            # why? jsonrpc methods use capitalized instead of lowercase. idk, see for yourself:
            # == > DirectGame.Challenge(42):
            # {
            #     "jsonrpc": "2.0",
            #     "method": "DirectGame.Challenge",
            #     "params": {
            #         "opponentDisplayName": "MTGATracker#78028",
            #         "avatar": "Sarkhan_M19_01",
            #         "deck": "{\"id\":\"c4d5e085-65c4-4873-9aaf-d9d081bde8e4\",\"name\":\"MTGA DOWN, PANIC
            #                     mk 02\",\"format\":\"Standard\",\"description\":\"\",
            #                     \"localDescription\":\"Temp string\",
            #                     \"deckTileId\":0,\"isValid\":true,\"lastUpdated\":\"2018-09-28T08:35:17.0184205\",
            #                     \"mainDeck\":[{\"Id\":67015,\"Quantity\":60},{\"Id\":67017,\"Quantity\":190}],\
            #                     \"sideboard\":[]}"
            #     },
            #     "id": "42"
            # }
            card = all_mtga_cards.search(card_obj[id_key])[0]
            for i in range(card_obj[qt_key]):
                if is_sideboard:
                    deck.side.append(card)
                else:
                    deck.cards.append(card)
        except Exception as e:
            mtga_app.mtga_logger.error("{}Unknown mtga_id: {}".format(ld(), card_obj))
            mtga_app.mtga_watch_app.send_error("Could not process deck {}: Unknown mtga_id: {}".format(deck.pool_name, card_obj))


def _process_maindeck_v3(deck, decklist_blob, is_sideboard=False):
    import app.mtga_app as mtga_app

    if len(decklist_blob) % 2 != 0:
        mtga_app.mtga_logger.error("{}Called _process_maindeck_v3 with odd number of cards: {}".format(ld(), len(decklist_blob)))
        mtga_app.mtga_watch_app.send_error("Could not process deck {}: _process_maindeck_v3 with odd number of cards: {}".format(deck.pool_name, len(decklist_blob)))
        return

    # split them into tuples: DOG THIS IS SICK https://docs.python.org/2/library/functions.html#zip
    card_tups = zip(*[iter(decklist_blob)]*2)
    for card_tup in card_tups:
        try:
            card_id = card_tup[0]
            quantity = card_tup[1]

            card = all_mtga_cards.search(card_id)[0]
            for i in range(quantity):
                if is_sideboard:
                    deck.side.append(card)
                else:
                    deck.cards.append(card)

        except Exception as e:
            mtga_app.mtga_logger.error("{}Unknown mtga_id: {}".format(ld(), card_id))
            mtga_app.mtga_watch_app.send_error("Could not process deck {}: Unknown mtga_id: {}".format(deck.pool_name, card_id))


def rank_rarity(rarity):
    # mythic rare, rare, uncommon, common, basic land; for sorting
    rarity_lower = rarity.lower()
    if "mythic" in rarity_lower:
        return 100
    elif "rare" in rarity_lower:
        return 80
    elif "uncommon" in rarity_lower:
        return 50
    elif "common" in rarity_lower:
        return 20
    return 0


def rank_colors(colors):
    color_val = 0
    if "W" in colors:
        color_val += 1
    if "U" in colors:
        color_val += 2
    if "B" in colors:
        color_val += 4
    if "R" in colors:
        color_val += 8
    if "G" in colors:
        color_val += 16
    if color_val == 0:
        color_val = 33
    return color_val


def rank_cost(cost):
    cost_total = 0
    for cost_bubble in cost:
        try:
            cost_total += int(cost_bubble)
        except:
            cost_total += 1
            if "x" in cost_bubble.lower():
                cost_total += 20  # ??
    return cost_total


def print_deck(deck_pool):
    import app.mtga_app as mtga_app
    print("Deck: {} ({} cards)".format(deck_pool.pool_name, len(deck_pool.cards)))
    mtga_app.mtga_logger.info("{}Deck: {} ({} cards)".format(ld(), deck_pool.pool_name, len(deck_pool.cards)))
    grouped = deck_pool.group_cards()
    for card in grouped.keys():
        print("  {}x {}".format(grouped[card], card))
        mtga_app.mtga_logger.info("{}  {}x {}".format(ld(), grouped[card], card))


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


# https://stackoverflow.com/questions/7674790/bundling-data-files-with-pyinstaller-onefile
def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    # PyInstaller creates a temp folder and stores path in _MEIPASS
    path = getattr(sys, '_MEIPASS', os.getcwd())
    return os.path.join(path, relative_path)

try:
    with open(resource_path(os.path.join('electron', 'package.json')), 'r') as package_file:
        client_version = json.load(package_file)["version"]
except FileNotFoundError:
    try:
        with open(resource_path(os.path.join('..', 'electron', 'package.json')), 'r') as package_file:
            client_version = json.load(package_file)["version"]
    except FileNotFoundError:
        with open(os.getcwd()+'\\package.json', 'r') as package_file:
            client_version = json.load(package_file)["version"]


class KillableTailer(Tailer):

    def __init__(self, file, kill_queue):
        """ based on tailer.Tailer

        :param file: file to tail
        :param kill_queue: put anything in here to kill tailer
        """
        self.kill_queue = kill_queue
        super().__init__(file)

    def follow(self, delay=1):
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
