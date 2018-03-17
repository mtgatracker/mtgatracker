#!/usr/bin/env bash
pyinstaller.exe app/mtgatracker_backend.py --distpath appdist
rm -rf build
rm -rf mtgatracker_backend.spec

./node_modules/.bin/electron-packager electron/ MTGATracker --overwrite --electron-version=1.7.6 --version=0.0.0 --extra-resource="appdist" --icon="electron/img/icon.ico"