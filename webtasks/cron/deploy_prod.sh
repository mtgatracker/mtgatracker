#!/usr/bin/env bash
wt cron create --secrets-file=secrets-staging --watch --schedule="1min" .
