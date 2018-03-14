# MTGA Tracker Frontend

The MTGA Tracker frontend is an electron app that uses node http module to communicate with the python flask webserver.

Based on [fyears/electron-python-example](https://github.com/fyears/electron-python-example).

### Setup

#### Setup python (one-time)

```bash
cd /path/to/mtga-tools/app
python -m virtualenv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

#### Setup electron (one-time)

```bash
cd /path/to/mtga-tools/app/front
npm install --runtime=electron --target=1.7.6
```

### Running it

```bash
./node_modules/.bin/electron
```

### Debugging

You might want to run your own version of the python log-watcher / flask server,
for example, in a pycharm debugging session. This is easy to do; simply set no_server to true in ``main.js``.
Electron should launch the UI, and you should see a red error until you start the debug server.
