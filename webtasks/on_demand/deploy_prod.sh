#!/usr/bin/env bash
wt_secret=$(cat secret-name)
client_version=$(cat client-version)
wt create . --bundle --name="mtgatracker-prod-$client_version-$wt_secret" --secrets-file=secrets --watch
