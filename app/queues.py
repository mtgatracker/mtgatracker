import multiprocessing

all_die_queue = multiprocessing.Queue()
block_read_queue = multiprocessing.Queue()
json_blob_queue = multiprocessing.Queue()
game_state_change_queue = multiprocessing.Queue()
decklist_change_queue = multiprocessing.Queue()
general_output_queue = multiprocessing.Queue()
collection_state_change_queue = multiprocessing.Queue()