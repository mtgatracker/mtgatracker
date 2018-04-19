#!/usr/bin/env bash

if (( "$#" != 1 ))
then
    echo "Must provide version string to use (e.g. 0.1.0-alpha)"
exit 1
fi

version=$1

# update version in package.json
fixversion="import json; rp = open('electron/package.json', 'r'); contents = json.load(rp); rp.close(); print('ok'); contents['version'] = '$version'; wp = open('electron/package.json', 'w'); json.dump(contents, wp, indent=4, separators=(',', ': '))"
python -c "$fixversion"

yes | pyinstaller.exe mtgatracker_backend.spec --distpath appdist
#rm -rf build
#rm -rf mtgatracker_backend.spec

rm -r MTGATracker-win32-x64 || echo "nothing to remove, moving on"
rm -r MTGATracker-win32-x64_$version || echo "nothing to remove, moving on"
rm -r MTGATracker-win32-x64_$version.zip || echo "nothing to remove, moving on"

yes | ./node_modules/.bin/electron-packager electron/ MTGATracker \
  --overwrite --version=$version --electron-version=1.7.6 \
  --ignore="\.git.*" --ignore=".*psd" --ignore="mtga_watch\.log.*" \
  --extra-resource="appdist" \
  --icon="electron/img/icon_small.ico" \
  --asar

mv MTGATracker-win32-x64 MTGATracker-win32-x64_$version
/c/Program\ Files/7-Zip/7z.exe a -tzip MTGATracker-win32-x64_$version.zip MTGATracker-win32-x64_$version
sha256sum MTGATracker-win32-x64_$version.zip