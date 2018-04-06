import csv
import json
import datetime
import random
from dateutil.parser import parse as parse_date

with open("../data/anon_lookup.csv", "r") as csvin:
    reader = csv.reader(csvin)
    lookup = {user: anon for user, anon in reader}

user_set = set()
anon_set = set()
for key, value in lookup.items():
    user_set.add(key)
    anon_set.add(value)

assert len(user_set) == len(anon_set)

with open('../data/04-05-2018_14-42_backup.json', 'r') as rf:
    all_docs = json.load(rf)["all_docs"]

anonymized_docs = {"all_docs": []}

for doc in all_docs:
    doc["winner"] = lookup[doc["winner"]]
    for player in doc["players"]:
        player_name = player["name"]
        anon_name = lookup[player_name]
        assert player_name in user_set
        player["name"] = anon_name
        if "visible cards" in player["deck"]["poolName"]:
            player["deck"]["poolName"] = player["deck"]["poolName"].replace(player_name, anon_name)
        else:
            player["deck"]["poolName"] = "{}'s deck".format(anon_name)
        del player["userID"]
        del player["deck"]

undated_records = len([r for r in all_docs if "date" not in r])
start_date = datetime.datetime(2018, 3, 22, tzinfo=datetime.timezone.utc)  # the day of the first release, https://github.com/shawkinsl/mtga-tracker/releases/tag/0.1.0-alpha
min_date = datetime.datetime(2018, 3, 27, tzinfo=datetime.timezone.utc)  # about when we turned on date tracking
undated_count = 0
undated_delta = (min_date - start_date) / undated_records

for rec in all_docs:
    if "date" in rec:
        rec_date = parse_date(rec["date"])
        min_date = min(min_date, rec_date)
        rec["date"] = str(rec_date)
    else:
        rec["date"] = str(start_date + (undated_delta * undated_count) + datetime.timedelta(hours=random.randint(-24, 24)))
        rec["errata"] = "date is estimated"
        undated_count += 1

with open("../data/anonymized_set.json", "w") as jsout:
    json.dump({"games": all_docs}, jsout, indent=4, separators=(',', ': '))

import IPython
IPython.embed()
