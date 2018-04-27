""" secrets_template.py

This file contains "staging" secrets only, i.e. secrets that will not allow any interaction with production
services. This file exists only so that contributors who are not privileged can still create working builds.

If this file is imported at runtime, no data will be sent to production services!
"""

DISCORD_WEBHOOK = "https://discordapp.com/api/insert/your/webhook/here"
API_URL = "https://wt-<container_name>.run.webtask.io/<webtask_name>"


def hash_json_object(obj):
    # do some secret operation on the data to create a verifiable hash
    return str(obj) + "987654321"
