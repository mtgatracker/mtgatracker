import hashlib
HASH_PASS = "59d5845da28cb5c15e4990"
STAGING_HASH_PASSWORD = "182a76a8d48bd068"
API_URL = "https://wt.mtgatracker.com/wt-bd90f3fae00b1572ed028d0340861e6a-0/mtgatracker-prod-EhDvLyq7PNb"
def hash_json_object(obj, password=HASH_PASS):
    md5_obj = hashlib.md5(obj["gameID"].encode("utf-8")).hexdigest()
    sha224 = hashlib.sha224(obj["gameID"].encode("utf-8")).hexdigest()
    return hashlib.sha256((md5_obj + password + sha224).encode("utf-8")).hexdigest()