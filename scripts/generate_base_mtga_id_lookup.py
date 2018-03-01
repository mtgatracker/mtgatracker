import json
import re

default_delta = 2  # card ID goes up by 2, to account for... foils, I guess?


def add_cardIDs_to_cardset(cardset, start_id):
    for card in cardset["cards"]:
        card["number_ab"] = None
        card_number = card["number"]
        if not card_number[-1].isdigit():
            a_b = card_number[-1]
            card_number = card_number[:-1]
            card["number_ab"] = a_b
        card["number_int"] = int(card_number)
        card["mtga_id"] = int(start_id)
        start_id += 2


with open("../set_data/XLN.json", "r", encoding='utf-8') as xln_r:
    ixalan_card_set = json.load(xln_r)
    add_cardIDs_to_cardset(ixalan_card_set, 65961)  # 65961 = adanto's vanguard, xln card 1
with open("../set_data/RIX.json", "r", encoding='utf-8') as rix_r:
    rivals_card_set = json.load(rix_r)
    add_cardIDs_to_cardset(rivals_card_set, 66619)  # 66619 = baffling end, rix card 1

lookup = {}
for card in rivals_card_set["cards"]:
    lookup[card["mtga_id"]] = card

for card in ixalan_card_set["cards"]:
    lookup[card["mtga_id"]] = card

with open("xln.py", "w") as ixw:
    header = """
import sys
from models.card import Card
from models.set import Set
import inspect
"""

    footer = """
clsmembers = [card for name, card in inspect.getmembers(sys.modules[__name__]) if isinstance(card, Card)]
Ixalan = Set("ixalan", cards=clsmembers)
"""
    already_written = set()
    ixw.write("{}\n\n".format(header))
    for card in ixalan_card_set["cards"]:
        card_name_class_cased = re.sub('[^0-9a-zA-Z_]', '', card["name"])
        card_name_class_cased_suffixed = card_name_class_cased
        card_suffix = 2
        while card_name_class_cased_suffixed in already_written:
            card_name_class_cased_suffixed = card_name_class_cased + str(card_suffix)
            card_suffix += 1
        card_name_snake_cased = re.sub('[^0-9a-zA-Z_]', '', card["name"].lower().replace(" ", "_"))
        mana_cost, color_identity = [], []
        if "manaCost" in card.keys():
            mana_cost = [m for m in re.split("[{}]", card["manaCost"]) if m]
        if "colorIdentity" in card.keys():
            color_identity = card["colorIdentity"]
        card_type = card["type"].replace(" — ", "-")
        subtype = ""
        if "-" in card_type:
            card_type, subtype = card_type.split("-")
        ixw.write('{} = Card("{}", "{}", {}, {}, "{}", "{}", "XLN", {}, {})\n'.format(
            card_name_class_cased_suffixed,
            card_name_snake_cased,
            card["name"],
            mana_cost,
            color_identity,
            card_type,
            subtype,
            card["number_int"],
            card["mtga_id"])
        )
        already_written.add(card_name_class_cased_suffixed)
    ixw.write("{}\n".format(footer))

with open("rix.py", "w") as ixw:
    header = """
import sys
from models.card import Card
from models.set import Set
import inspect
"""

    footer = """
clsmembers = [card for name, card in inspect.getmembers(sys.modules[__name__]) if isinstance(card, Card)]
RivalsOfIxalan = Set("rivals_of_ixalan", cards=clsmembers)
"""
    already_written = set()
    ixw.write("{}\n\n".format(header))
    for card in rivals_card_set["cards"]:
        card_name_class_cased = re.sub('[^0-9a-zA-Z_]', '', card["name"])
        card_name_class_cased_suffixed = card_name_class_cased
        card_suffix = 2
        while card_name_class_cased_suffixed in already_written:
            card_name_class_cased_suffixed = card_name_class_cased + str(card_suffix)
            card_suffix += 1
        card_name_snake_cased = re.sub('[^0-9a-zA-Z_]', '', card["name"].lower().replace(" ", "_"))
        mana_cost, color_identity = [], []
        if "manaCost" in card.keys():
            mana_cost = [m for m in re.split("[{}]", card["manaCost"]) if m]
        if "colorIdentity" in card.keys():
            color_identity = card["colorIdentity"]
        card_type = card["type"].replace(" — ", "-")
        subtype = ""
        if "-" in card_type:
            card_type, subtype = card_type.split("-")
        ixw.write('{} = Card("{}", "{}", {}, {}, "{}", "{}", "RIX", {}, {})\n'.format(
            card_name_class_cased_suffixed,
            card_name_snake_cased,
            card["name"],
            mana_cost,
            color_identity,
            card_type,
            subtype,
            card["number_int"],
            card["mtga_id"])
        )
        already_written.add(card_name_class_cased_suffixed)
    ixw.write("{}\n".format(footer))