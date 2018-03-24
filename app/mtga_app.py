import json
import threading
import os
import logging.handlers
import sys
import requests

from app.queues import general_output_queue
from app.models.set import Deck


log_file = "mtga_watch.log"
mtga_logger = logging.getLogger("mtga_watch")
stdout_handler = logging.StreamHandler(sys.stdout)
must_rollover = False
if os.path.exists(log_file):  # check before creating the handler, which creates the file
    must_rollover = True
rotating_handler = logging.handlers.RotatingFileHandler(log_file, backupCount=10)
if must_rollover:
    rotating_handler.doRollover()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
rotating_handler.setFormatter(formatter)
stdout_handler.setFormatter(formatter)
mtga_logger.addHandler(rotating_handler)
mtga_logger.setLevel(logging.DEBUG)


class MTGAWatchApplication(object):
    def __init__(self):
        self.game = None
        self.game_lock = threading.Lock()
        self._log_bit_count = 1
        self.player_id = None
        self.intend_to_join_game_with = None
        self.player_decks = {}
        self.last_blob = None
        self.error_count = 0
        self.web_api = WebAPI()

        home_path = os.path.expanduser("~")
        self._settings_path = os.path.join(home_path, ".mtga_tracker")
        self._settings_json_path = os.path.join(self._settings_path, "settings.json")
        self.load_settings()

    def send_error(self, error):
        self.error_count += 1
        general_output_queue.put({"error": "MTGAWatchError", "msg": error, "count": self.error_count})

    def send_message(self, message):
        general_output_queue.put({"color": "black", "msg": message})

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
            mtga_watch_app.send_error("Error loading settings; had to move settings.json -> settings.json.bak")
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


class WebAPI(object):

    def __init__(self, api_url="https://wt-bd90f3fae00b1572ed028d0340861e6a-0.run.webtask.io/mtga-tracker-game"):
        self.api_url = api_url

    def save_game_result(self, game):
        url = self.api_url + "/game"
        print(requests.post(url, json=game).json())


mtga_watch_app = MTGAWatchApplication()
