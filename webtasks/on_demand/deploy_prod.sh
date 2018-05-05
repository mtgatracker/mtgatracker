#!/usr/bin/env bash
wt_secret=$(cat secret-name)
wt_host=$(cat secret-host)
wt create . --bundle --bundle-minify --host="$wt_host" --name="mtgatracker-prod-$wt_secret" --secrets-file=secrets --watch
