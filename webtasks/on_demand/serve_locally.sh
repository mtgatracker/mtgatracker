#!/bin/bash
echo "MONGO_URL=$MONGO_URL" >> secrets-staging
echo "DEBUG_PASSWORD=$DEBUG_PASSWORD" >> secrets-staging
echo "DATABASE=$DATABASE" >> secrets-staging
echo "DISCORD_WEBHOOK=$DISCORD_WEBHOOK" >> secrets-staging
cat secrets-staging
wt serve . --hostname localhost --port 8080 --secrets-file=secrets-staging > local_webtask_output.txt &
sleep 10