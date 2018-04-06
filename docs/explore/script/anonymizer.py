import csv
import json
import sys
print("don't run this anymore lol")
sys.exit(1)

anon_name_bank = set()

with open("../data/anon_names.txt", "r") as anf:
    anon_name_list = anf.readlines()
for name in anon_name_list:
    anon_name_bank.add(name.replace(" ", "_").strip())
print(len(anon_name_bank))

with open("../data/04-05-2018_14-42_backup.json", "r") as inf:
    all_data = json.load(inf)['all_docs']

print(len(all_data))

unique_players = set()
all_players = set()

for doc in all_data:
    for player in doc["players"]:
        if "visible cards" not in player["deck"]["poolName"]:
            unique_players.add(player["name"])
        all_players.add(player["name"])

all_players = list(all_players)
anon_name_bank = list(anon_name_bank)

with open("../data/anon_lookup.csv", 'w', newline='') as wf:
    anon_writer = csv.writer(wf)
    for key, value in zip(all_players, anon_name_bank):
        anon_writer.writerow([key, value])

import IPython
IPython.embed()
