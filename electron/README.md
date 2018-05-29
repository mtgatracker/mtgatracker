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

#### Deploying / Auto-updates

Deployable versions of MTGATracker are built with `build.sh` to the path `MTGATracker-win32-x64_x.y.z-SQUIRREL`.
Once the build is complete, the following files need to be manually uploaded
to s3 (https://s3-us-west-1.amazonaws.com/mtgatracker/autoupdates/win/RELEASES), but once they are there,
autoUpdater & squirrel will take care of the rest. 

- RELEASES
- mtgatracker-*-full.nupkg
- mtgatracker-*-delta.nupkg

The `setup.exe` does _not_ need to be uploaded to s3, but should be released to github as the "installer."

Note that the squirrel builder requires that there is _something_ available at the remote address. In order
to get around this (for an initial release, for example), you probably need to comment the following line out
in `build.sh` :

    remoteReleases: 'https://s3-us-west-1.amazonaws.com/mtgatracker/autoupdates/win',
