import json
import pprint

in_file = "5cs.txt"
out_fstr = "game_{}.txt"
cur_idx = 0
game_found = False
game_out = ""

last_block = ""


def _get_state_type(json_block):
    if "matchGameRoomStateChangedEvent" in json_block\
            and 'gameRoomInfo' in json_block['matchGameRoomStateChangedEvent']\
            and 'stateType' in json_block['matchGameRoomStateChangedEvent']['gameRoomInfo']:
        return json_block['matchGameRoomStateChangedEvent']['gameRoomInfo']['stateType']


def check_json_for_game_start(json_block):
    return "method" in json_block and json_block["method"] == "Event.JoinQueue"

def check_json_for_game_end(json_block):
    return _get_state_type(json_block) == "MatchGameRoomStateType_MatchCompleted"


with open(in_file, 'r') as inf:
    for idx, line in enumerate(inf):
        if idx % 10000 == 0:
            print(".", end="")
        if game_found:
            game_out += line
        if line.strip() == "":
            block_lines = last_block.split("\n")
            first_line = block_lines[0].strip()
            second_line = None
            if len(block_lines) > 1:
                second_line = block_lines[1].strip()
            if first_line and first_line[-1] == "[":
                list_name = first_line.split(" ")[-2]
                idx_first_sq_bracket = last_block.index("[")
                idx_last_sq_bracket = last_block.rindex("]") + 1
                list_blob = '{{"{}": '.format(list_name) + last_block[idx_first_sq_bracket:idx_last_sq_bracket] + " }"
                try:
                    blob = json.loads(list_blob)
                    if check_json_for_game_start(blob):
                        game_found = True
                        game_out += str(last_block + "\n\n")
                    elif check_json_for_game_end(blob):
                        print("game {} complete".format(cur_idx))
                        fname = out_fstr.format(cur_idx)
                        with open(fname, 'w') as outf:
                            outf.write(game_out)
                        game_out = ""
                        game_found = False
                        cur_idx += 1
                except:
                    print("----- ERROR parsing list json blob  :( `{}`".format(list_blob))
            elif first_line and first_line[-1] == "{" or second_line and second_line == "{":
                idx_first_bracket = last_block.index("{")
                idx_last_bracket = last_block.rindex("}") + 1

                json_blob = last_block[idx_first_bracket:idx_last_bracket]
                try:
                    blob = json.loads(json_blob)
                    if check_json_for_game_start(blob):
                        game_found = True
                        game_out += str(last_block + "\n\n")
                    elif check_json_for_game_end(blob):
                        fname = out_fstr.format(cur_idx)
                        with open(fname, 'w') as outf:
                            outf.write(game_out)
                        game_out = ""
                        print("game {} complete".format(cur_idx))
                        game_found = False
                        cur_idx += 1
                except:
                    print("----- ERROR parsing normal json blob :( `{}`".format(json_blob))
            last_block = ""
        else:
            last_block += line.strip() + "\n"
    print("fin")
