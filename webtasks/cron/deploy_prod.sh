#!/usr/bin/env bash
wt cron create --secrets-file=secrets --watch --schedule="1min" .
