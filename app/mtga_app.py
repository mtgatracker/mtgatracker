import threading
import os
import datetime
import tailer
import app.queues as queues
import app.tasks as tasks
import time

from app.queues import block_read_queue, json_blob_queue

appdata_roaming = os.getenv("APPDATA")
wotc_locallow_path = os.path.join(appdata_roaming, "..", "LocalLow", "Wizards Of The Coast", "MTGA")
output_log = os.path.join(wotc_locallow_path, "output_log.txt")


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

    def make_logchunk_file(self, filename, output, print_to_stdout=True):
        logchunk_filename = "{}_{}.txt".format(os.path.join(self._log_dir, str(self._log_bit_count)), filename)
        with open(logchunk_filename, 'w') as wf:
            wf.write(str(output))
            self._log_bit_count += 1
        if print_to_stdout:
            print("created logchunk at {}".format(logchunk_filename))


mtga_watch_app = MTGAWatchApplication()


def check_game_state_forever():
    while(1):
        with mtga_watch_app.game_lock:
            if mtga_watch_app.game and mtga_watch_app.game.hero:
                print("~!~"*30)
                print("{} hand: {}".format(mtga_watch_app.game.hero.player_name, mtga_watch_app.game.hero.hand))
                print("{}  lib: {}".format(mtga_watch_app.game.hero.player_name, mtga_watch_app.game.hero.library))
                print("~!~"*30)
                print("queue_size: {} / {}".format(block_read_queue.qsize(), json_blob_queue.qsize()))
                print("~!~"*30)
                print("{} hand: {}".format(mtga_watch_app.game.opponent.player_name, mtga_watch_app.game.opponent.hand))
                print("{}  lib: {}".format(mtga_watch_app.game.opponent.player_name, mtga_watch_app.game.opponent.library))
                print("~!~"*30)
                if mtga_watch_app.game.hero.hand.cards:
                    mtga_watch_app.game.hero.calculate_draw_odds()
            else:
                print("check_game_state: no data yet, but {} :(".format(id(mtga_watch_app.game)))
        time.sleep(1)

