import sys, os
path_to_root = os.path.abspath(os.path.join(__file__, "..", ".."))
print(path_to_root)
sys.path.append(path_to_root)

import threading
import functools
import tailer

from app import tasks, queues
from app.mtga_app import output_log
import logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)


if __name__ == "__main__":

    block_watch_process = threading.Thread(target=tasks.block_watch_task, args=(queues.block_read_queue, queues.json_blob_queue, ))
    block_watch_process.start()

    from app.flask_app import http_app
    partial = functools.partial(http_app.run, port=8080)
    flask_thread = threading.Thread(target=partial)
    flask_thread.start()
    print("running")

    json_watch_process = threading.Thread(target=tasks.json_blob_reader_task, args=(queues.json_blob_queue, queues.json_blob_queue, ))
    json_watch_process.start()
    current_block = ""
    for line in tailer.follow(open(output_log)):
        if line.strip() == "":
            queues.block_read_queue.put(current_block)
            current_block = ""
        else:
            current_block += line.strip() + "\n"