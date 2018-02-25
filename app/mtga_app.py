import json
import threading
import os
import logging

import sys

from models.set import Deck
import datetime


now = datetime.datetime.now()
log_file = "mtga_watch-{}_{}_{}-{}_{}_{}.log".format(now.month, now.day, now.year, now.hour, now.minute, now.second)
mtga_logger = logging.getLogger("mtga_watch")
stdout_handler = logging.StreamHandler(sys.stdout)
file_handler = logging.FileHandler(log_file)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
stdout_handler.setFormatter(formatter)
mtga_logger.addHandler(file_handler)
mtga_logger.setLevel(logging.DEBUG)


class MTGAWatchApplication(object):
    def __init__(self):
        self.game = None
        self.game_lock = threading.Lock()
        now = datetime.datetime.now()
        self._log_dir = "mtga_app_logs/{}_{}_{}-{}_{}_{}".format(now.month, now.day, now.year,
                                                                 now.hour, now.minute, now.second)

        os.makedirs(self._log_dir, exist_ok=True)
        self._log_bit_count = 1
        self.player_id = None
        self.intend_to_join_game_with = None
        self.player_decks = {}
        self.last_blob = None

        home_path = os.path.expanduser("~")
        self._settings_path = os.path.join(home_path, ".mtga_tracker")
        self._settings_json_path = os.path.join(self._settings_path, "settings.json")
        self.load_settings()

    def make_logchunk_file(self, filename, output, print_to_stdout=True):
        logchunk_filename = "{}_{}.txt".format(os.path.join(self._log_dir, str(self._log_bit_count)), filename)
        with open(logchunk_filename, 'w') as wf:
            wf.write(str(output))
            self._log_bit_count += 1
        if print_to_stdout:
            mtga_logger.info("created logchunk at {}".format(logchunk_filename))

    def load_settings(self):
        mtga_logger.debug("loading settings")
        os.makedirs(self._settings_path, exist_ok=True)
        if not os.path.exists(self._settings_json_path):
            with open(self._settings_json_path, 'w') as wp:
                json.dump({"player_decks": {}, "player_id": None}, wp)
        try:
            with open(self._settings_json_path) as rp:
                settings = json.load(rp)
        except:
            mtga_logger.error("had to move settings.json -> settings.json.bak, trying again...")
            os.rename(self._settings_json_path, self._settings_json_path + ".bak")
            return self.load_settings()
        if "player_id" in settings and settings["player_id"]:
            self.player_id = settings["player_id"]
        if "player_decks" in settings and settings["player_decks"]:
            for deck_id in settings["player_decks"]:
                self.player_decks[deck_id] = Deck.from_dict(settings['player_decks'][deck_id])

    def save_settings(self):
        mtga_logger.debug("saving settings")
        with open(self._settings_json_path, 'w') as wp:
            write_obj = {
                "player_decks": {d.deck_id: d.to_serializable() for d in self.player_decks.values()},
                "player_id": self.player_id
            }
            json.dump(write_obj, wp)


mtga_watch_app = MTGAWatchApplication()
