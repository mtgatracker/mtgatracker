import threading
import functools
import logging
import time
from app import tasks, queues
import requests

log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)


if __name__ == "__main__":

    block_watch_process = threading.Thread(target=tasks.block_watch_task, args=(queues.block_read_queue, queues.json_blob_queue, ))
    block_watch_process.start()

    json_watch_process = threading.Thread(target=tasks.json_blob_reader_task, args=(queues.json_blob_queue, queues.json_blob_queue, ))
    json_watch_process.start()
    current_block = ""
    from app.flask_app import http_app
    partial = functools.partial(http_app.run, port=8080)
    flask_thread = threading.Thread(target=partial)
    flask_thread.start()
    res = requests.get("http://localhost:8080")

    while not res.status_code == 200:
        res = requests.get("http://localhost:8080")
        time.sleep(1)

    with open("../example_logs/single_game.txt", 'r') as rf:
        all_lines = rf.readlines()
        for idx, line in enumerate(all_lines):
            if line.strip() == "":
                queues.block_read_queue.put(current_block)
                current_block = ""
            else:
                current_block += line.strip() + "\n"
    queues.block_read_queue.put(None)
    block_watch_process.join()
    json_watch_process.join()
    requests.get("http://localhost:8080/die")
    # warning: this makes flask not very happy and you will get a ValueError... but we DO successfully terminate :)
