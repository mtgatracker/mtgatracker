import json
import re

default_delta = 2  # card ID goes up by 2, to account for... foils, I guess?

# 64813 = cartouche of solidarity
# 65273 = Spring /// Mind
# 65729 = pride sovereign
# 65349 = start /// finish
# 66600 = acrobatic maneuver / 65425 = Woodland Stream


special_layouts = {"aftermath": 3}


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
        if "layout" in card.keys() and card["layout"] in special_layouts.keys():
            start_id += special_layouts[card["layout"]]
        else:
            start_id += 2


with open("all_cards.json", "r") as aci:
    all_cards = json.load(aci)


def map_set_using_lookup(cards, set, lookup):
    for card in cards["cards"]:
        card_number = int(card["number"])
        grp_id = lookup[card_number]["grpid"]
        card["mtga_id"] = grp_id
        card["number_int"] = card_number

all_card_sets = set([card["set"] for card in all_cards["all_cards"]])
lookup_by_set_and_num = {card_set: {int(v["CollectorNumber"]): v for v in all_cards["all_cards"] if v["set"] == card_set and v["isCollectible"] == True} for card_set in all_card_sets}


# with open("../app/set_data/XLN.json", "r", encoding='utf-8') as xln_r:
#     ixalan_card_set = json.load(xln_r)
#     add_cardIDs_to_cardset(ixalan_card_set, 65961)  # 65961 = adanto's vanguard, xln card 1
#
# with open("../app/set_data/RIX.json", "r", encoding='utf-8') as rix_r:
#     rivals_card_set = json.load(rix_r)
#     add_cardIDs_to_cardset(rivals_card_set, 66619)  # 66619 = baffling end, rix card 1
#
# with open("../app/set_data/AKH.json", "r", encoding='utf-8') as akh_r:
#     amonkhet_card_set = json.load(akh_r)
#     add_cardIDs_to_cardset(amonkhet_card_set, 64801)  # 64801 = angel of sanctions, akh card 1
#
# with open("../app/set_data/HOU.json", "r", encoding='utf-8') as hou_r:
#     hour_card_set = json.load(hou_r)
#     add_cardIDs_to_cardset(hour_card_set, 65479)  # 65479 = act of heroism, hou card 1

# with open("../app/set_data/DOM.json", "r", encoding='utf-8') as dom_r:
#     dom_card_set = json.load(dom_r)
#     add_cardIDs_to_cardset(dom_card_set, 67106)  # 65479 = act of heroism, hou card 1

with open("KLD.json", "r", encoding='utf-8') as kld_r:
    kld_card_set = json.load(kld_r)
    map_set_using_lookup(kld_card_set, "KLD", lookup_by_set_and_num["KLD"])


with open("AER.json", "r", encoding='utf-8') as aer_r:
    aer_card_set = json.load(aer_r)
    map_set_using_lookup(aer_card_set, "AER", lookup_by_set_and_num["AER"])


with open("W17.json", "r", encoding='utf-8') as w17_r:
    w17_card_set = json.load(w17_r)
    map_set_using_lookup(w17_card_set, "W17", lookup_by_set_and_num["W17"])


# lookup = {}
# for card in rivals_card_set["cards"]:
#     lookup[card["mtga_id"]] = card
#
# for card in ixalan_card_set["cards"]:
#     lookup[card["mtga_id"]] = card


def write_set(set_mnemonic, set_fullname, card_data):
    set_name_class_cased = re.sub('[^0-9a-zA-Z_]', '', set_fullname)
    set_name_snake_cased = re.sub('[^0-9a-zA-Z_]', '', set_fullname.lower().replace(" ", "_"))
    with open("{}.py".format(set_mnemonic.lower()), "w") as set_file:
        header = """
import sys
from app.models.card import Card
from app.models.set import Set
import inspect
"""

        footer = """
clsmembers = [card for name, card in inspect.getmembers(sys.modules[__name__]) if isinstance(card, Card)]
{} = Set("{}", cards=clsmembers)
""".format(set_name_class_cased, set_name_snake_cased)
        already_written = set()
        set_file.write("{}\n\n".format(header))
        for card in card_data["cards"]:
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
                card_type, *subtypes = card_type.split("-")
                subtype = "-".join(subtypes)
            if "—" in card_type:
                card_type, *subtypes = card_type.split("—")
                subtype = "-".join(subtypes)

            set_file.write('{} = Card("{}", "{}", {}, {}, "{}", "{}", "{}", {}, {})\n'.format(
                card_name_class_cased_suffixed,
                card_name_snake_cased,
                card["name"],
                mana_cost,
                color_identity,
                card_type,
                subtype,
                set_mnemonic,
                card["number_int"],
                card["mtga_id"])
            )
            already_written.add(card_name_class_cased_suffixed)
        set_file.write("{}\n".format(footer))


# write_set("XLN", "Ixalan", ixalan_card_set)
# write_set("RIX", "Rivals Of Ixalan", rivals_card_set)
# write_set("AKH", "Amonkhet", amonkhet_card_set)
# write_set("HOU", "Hour Of Devastation", hour_card_set)
write_set("KLD", "Kaladesh", kld_card_set)
write_set("AER", "Aether Revolt", aer_card_set)
write_set("W17", "Welcome Decks 2017", aer_card_set)
