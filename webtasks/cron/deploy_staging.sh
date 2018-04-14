#!/usr/bin/env bash
wt cron create --secrets-file=secrets-staging --name='mtga-tracker-upkeep-staging' --watch --schedule="2mins" .
