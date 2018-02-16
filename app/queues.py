import multiprocessing

block_read_queue = multiprocessing.Queue()
json_blob_queue = multiprocessing.Queue()
game_state_change_queue = multiprocessing.Queue()
collection_state_change_queue = multiprocessing.Queue()