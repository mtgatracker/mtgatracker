#!/usr/bin/env bash
yes | pyinstaller.exe app/mtgatracker_backend.py --distpath appdist
#rm -rf build
#rm -rf mtgatracker_backend.spec

yes | ./node_modules/.bin/electron-packager electron/ MTGATracker \
  --overwrite --version=0.0.0 --electron-version=1.7.6 \
  --ignore="\.git.*" --ignore=".*psd" --ignore="mtga_watch\.log.*" \
  --extra-resource="appdist" \
  --icon="electron/img/icon_small.ico" \
  --asar