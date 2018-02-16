import threading


class MTGAWatchApplication(object):
    def __init__(self):
        self.game = None
        self.game_lock = threading.Lock()


mtga_watch_app = MTGAWatchApplication()
