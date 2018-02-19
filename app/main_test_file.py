import threading
import time
import flask
import functools

from app import tasks, queues
from app.mtga_app import check_game_state_forever, mtga_watch_app



if __name__ == "__main__":

    block_watch_process = threading.Thread(target=tasks.block_watch_task, args=(queues.block_read_queue, queues.json_blob_queue, ))
    block_watch_process.start()

    watch = threading.Thread(target=check_game_state_forever)
    watch.start()

    json_watch_process = threading.Thread(target=tasks.json_blob_reader_task, args=(queues.json_blob_queue, queues.json_blob_queue, ))
    json_watch_process.start()
    current_block = ""
    from app.flask_app import http_app
    partial = functools.partial(http_app.run, port=8080)
    flask_thread = threading.Thread(target=partial)
    flask_thread.start()
    print("running")
    with open("../example_logs/single_game.txt", 'r') as rf:
        all_lines = rf.readlines()
        for idx, line in enumerate(all_lines):
            if line.strip() == "":
                queues.block_read_queue.put(current_block)
                current_block = ""
            else:
                current_block += line.strip() + "\n"