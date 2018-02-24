import threading
import os
import datetime


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
