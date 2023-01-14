import datetime
import sys

import app.models.set as mset
from app.mtga_app import mtga_watch_app
from app.models.card import GameCard
from app.models.set import Deck
from util import all_mtga_cards
try:
    from app._secrets import API_URL, hash_json_object
except ImportError:
    sys.stderr.write("WARNING! Using secrets template; this will not hit production databases!")
    from app.secrets_template import API_URL, hash_json_object


class Player(object):
    def __init__(self, player_name, player_id, seat, battlefield, exile, limbo, stack, deck_cards=None):
        self.player_name = player_name
        self.player_id = player_id
        self.seat = seat
        self.current_life_total = 20

        self.mulligan_count = 0
        self.starting_hand = 0

        self.library = mset.Library("{}'s library".format(self.player_name), deck_cards, seat)
        self.hand = mset.Zone("{}'s hand".format(self.player_name))
        self.graveyard = mset.Zone("{}'s graveyard".format(self.player_name))
        self.exile = exile
        self.limbo = limbo
        self.battlefield = battlefield
        self.stack = stack
        self.is_hero = False
        self.original_deck = None
        self._deck_cards = deck_cards

        self.private_zones = [self.library, self.hand, self.graveyard]
        self.shared_zones = [self.exile, self.battlefield, self.limbo, self.stack]
        self.all_zones = self.private_zones + self.shared_zones

    @property
    def total_cards_in_all_zones(self):
        total = sum([zone.total_count for zone in self.private_zones])
        total += sum([zone.count_cards_owned_by(self.seat) for zone in self.shared_zones])
        return total

    def get_zone_by_name(self, name):
        # ["ZoneType_Hand", "ZoneType_Library", "ZoneType_Graveyard", "ZoneType_Exile", "ZoneType_Limbo"]
        if name == "ZoneType_Hand":
            return self.hand
        elif name == "ZoneType_Library":
            return self.library
        elif name == "ZoneType_Graveyard":
            return self.graveyard
        elif name == "ZoneType_Exile":
            return self.exile
        elif name == "ZoneType_Limbo":
            return self.limbo
        elif name == "ZoneType_Stack":
            return self.stack
        elif name == "ZoneType_Battlefield":
            return self.battlefield

    def get_location_of_instance(self, instance_id):
        for zone in self.all_zones:
            for card in zone.cards:
                if card.game_id == instance_id or instance_id in card.previous_iids:
                    return card, zone
            for ability in zone.abilities:
                if ability.game_id == instance_id:
                    return ability, zone
        return None, None

    def put_instance_id_in_zone(self, instance_id, owner_id, zone):
        card, current_zone = self.get_location_of_instance(instance_id)
        if current_zone:
            if current_zone != zone:
                # mtga_logger.info("-- iid {} => {}".format(instance_id, card))
                current_zone.transfer_card_to(card, zone)
        else:
            unknown_card = GameCard("unknown", "unknown", [], [], "", "", -1, "Unknown", -1, -1, owner_id, instance_id)
            # mtga_logger.info("-- iid {} => {}".format(instance_id, unknown_card))
            zone.cards.append(unknown_card)

    @property
    def draw_odds_measurable(self):
        return True if self.original_deck else False

    def calculate_draw_odds(self, ignored_iids=None):
        if ignored_iids is None:
            ignored_iids = set()
        cards_not_in_library = set()
        for zone in self.all_zones:
            if zone != self.library:
                for card in zone.cards:
                    assert isinstance(card, GameCard)
                    if card.owner_seat_id == self.seat and card.mtga_id != -1:  # don't bother for unknown cards; they're unknown!
                        if card.game_id not in ignored_iids:
                            cards_not_in_library.add(card)
        assert isinstance(self.original_deck, Deck), "{} {}".format(self.original_deck, type(self.original_deck))
        current_list = self.original_deck.cards.copy()
        for card in cards_not_in_library:
            simple_card = all_mtga_cards.find_one(card.mtga_id)
            try:
                current_list.remove(simple_card)
            except:
                mtga_watch_app.send_error("Card wasn't in library to remove?")
        # #155: send unmodified odds for static mode
        original_deck_odds = {}
        for card in self.original_deck.cards:
            if card.mtga_id not in original_deck_odds.keys():
                original_deck_odds[card.mtga_id] = {
                    "card": card.pretty_name,
                    "iid": None,
                    "colors": card.colors,
                    "cost": card.cost,
                    "card_type": card.card_type,
                    "card_subtype": card.sub_types,
                    "count_in_deck": 0,
                    "odds_unf": 0,
                    "odds_of_draw": 0,
                }
                if isinstance(card, GameCard):
                    original_deck_odds[card.mtga_id]['iid'] = card.game_id

            original_deck_odds[card.mtga_id]["count_in_deck"] += 1
            original_deck_odds[card.mtga_id]["odds_unf"] = 100 * original_deck_odds[card.mtga_id]["count_in_deck"] / len(self.original_deck.cards)
            original_deck_odds[card.mtga_id]["odds_of_draw"] = "{:.2f}".format(original_deck_odds[card.mtga_id]["odds_unf"])
        odds = {}
        for card in current_list:
            if card.mtga_id not in odds.keys():
                odds[card.mtga_id] = {
                    "card": card.pretty_name,
                    "iid": None,
                    "colors": card.colors,
                    "cost": card.cost,
                    "card_type": card.card_type,
                    "card_subtype": card.sub_types,
                    "count_in_deck": 0,
                    "odds_unf": 0,
                    "odds_of_draw": 0,
                }
                if isinstance(card, GameCard):
                    odds[card.mtga_id]['iid'] = card.game_id

            odds[card.mtga_id]["count_in_deck"] += 1
            odds[card.mtga_id]["odds_unf"] = 100 * odds[card.mtga_id]["count_in_deck"] / len(current_list)
            odds[card.mtga_id]["odds_of_draw"] = "{:.2f}".format(odds[card.mtga_id]["odds_unf"])
        odds_list = [odds[k] for k in odds.keys()]
        odds_list.sort(key=lambda x: x["odds_unf"])
        original_odds_list = [original_deck_odds[k] for k in original_deck_odds.keys()]
        original_odds_list.sort(key=lambda x: x["odds_unf"])
        info = {
            "stats": list(reversed(odds_list)),
            "original_deck_stats": list(reversed(original_odds_list)),
            "deck_name": self.original_deck.pool_name,
            "total_cards_in_deck": len(current_list),
            "original_decklist_total": len(self.original_deck.cards),
            "library_contents": [c.to_serializable() for c in current_list],
            "last_drawn": None
        }
        return info

    def played_cards_to_min_json(self):
        known_cards = {}
        for zone in self.shared_zones + [self.hand, self.graveyard]:
            for card in zone.cards:
                if card.owner_seat_id == self.seat and card.mtga_id:
                    if card.mtga_id not in known_cards:
                        known_cards[card.mtga_id] = 0
                    known_cards[card.mtga_id] += 1
        return known_cards

    def seen_cards_to_min_json(self):
        known_cards = {}
        for zone in self.all_zones:
            for card in zone.cards:
                if card.owner_seat_id == self.seat and card.mtga_id:
                    if card.mtga_id not in known_cards:
                        known_cards[card.mtga_id] = 0
                    known_cards[card.mtga_id] += 1
        return {
            "deckID": "unknown",
            "poolName": "{}'s visible cards".format(self.player_name),
            "cards": known_cards
        }


class Match(object):
    def __init__(self, match_id):
        self.__match_id = match_id
        self.game_results = []
    
    @property
    def event_id(self):
        return self.__event_id

    @event_id.setter
    def event_id(self, event_id):
        self.__event_id = event_id
    
    @property
    def opponent_name(self):
        return self.__opponent_name

    @opponent_name.setter
    def opponent_name(self, opponent_name):
        self.__opponent_name = opponent_name
        
    @property
    def opponent_rank(self):
        return self.__opponent_rank

    @opponent_rank.setter
    def opponent_rank(self, opponent_rank):
        self.__opponent_rank = opponent_rank
        
    def current_game_number(self):
        return len(self.game_results) + 1

    def has_results(self, game_number):
        return len(self.game_results) > game_number

    def add_result(self, result):
        self.game_results.append(result)


class Game(object):
    def __init__(self, match_id, hero, opponent, shared_battlefield, shared_exile, shared_limbo, shared_stack,
                 event_id, opponent_rank="Unknown"):
        self.match_id = match_id
        self.final = False
        self.winner = None
        self.on_the_play = None

        # TargetSpec annotations fire more than once. The dirty hack is to just note which you've
        # already recorded and ignore them.
        self.recorded_targetspecs = []

        # so we can send the event log to inspector, as well
        self.events = []

        self.hero = hero
        assert isinstance(self.hero, Player)
        self.opponent = opponent
        assert isinstance(self.opponent, Player)
        self.battlefield = shared_battlefield
        self.exile = shared_exile
        self.limbo = shared_limbo
        self.stack = shared_stack

        self.ignored_iids = set()
        self.last_hero_library_hash = None
        self.last_opponent_hand_hash = None

        self.start_time = datetime.datetime.now()

        self.log_start_time = None

        self.last_log_timestamp = None
        self.last_measured_timestamp = None
        self.last_decision_player = None

        self.chess_timer = []

        self.turn_number = 1
        self.current_player = None
        self.current_phase = "Game_Start"
        self.opponent_rank = opponent_rank
        self.event_id = event_id

    def game_state(self):
        hero_chess_time_total, oppo_chess_time_total = self.calculate_chess_timer_total()
        game_state = {
            "game_id": self.match_id,
            "deck_id": self.hero.original_deck.deck_id,
            "draw_odds": self.hero.calculate_draw_odds(self.ignored_iids),
            "opponent_hand": [c.to_serializable() for c in self.opponent.hand.cards],
            "elapsed_time": str(datetime.datetime.now() - self.start_time),
            "turn_number": self.turn_number,
            "hero_time_spent": hero_chess_time_total,
            "oppo_time_spent": oppo_chess_time_total,
            "heroIsDeciding": self.last_decision_player == self.hero
        }
        return game_state

    def register_zone(self, zone_blob):
        zone_id = zone_blob["zoneId"]
        zone_name = zone_blob["type"]
        if "ownerSeatId" in zone_blob:
            player = self.get_player_in_seat(zone_blob["ownerSeatId"])
            zone = player.get_zone_by_name(zone_name)
            zone.zone_id = zone_id
        else:
            zone = self.hero.get_zone_by_name(zone_name)
            zone.zone_id = zone_id

    def get_owner_zone_tup(self, zone_id):
        assert isinstance(self.hero, Player)
        for zone in self.hero.private_zones:
            if zone.zone_id == zone_id:
                return self.hero, zone
        for zone in self.opponent.private_zones:
            if zone.zone_id == zone_id:
                return self.opponent, zone
        for zone in self.hero.shared_zones:
            if zone.zone_id == zone_id:
                return None, zone
        return None, None

    def get_player_in_seat(self, seat_id):
        from app.mtga_app import mtga_logger
        if self.hero.seat == seat_id:
            return self.hero
        elif self.opponent.seat == seat_id:
            return self.opponent
        else:
            mtga_logger.info("NOTHING TO RETURN OH NO")

    def find_card_by_iid(self, instance_id):
        assert isinstance(self.hero, Player)
        card, zone = self.hero.get_location_of_instance(instance_id)
        if card:
            return card
        card, zone = self.opponent.get_location_of_instance(instance_id)
        if card:
            return card
        return None

    def calculate_chess_timer_total(self):
        hero_chess_time_total = datetime.timedelta(0)
        oppo_chess_time_total = datetime.timedelta(0)

        for chunk in self.chess_timer:
            if chunk["countsAgainst"] == self.hero:
                hero_chess_time_total = chunk["diff"] + hero_chess_time_total
            if chunk["countsAgainst"] == self.opponent:
                oppo_chess_time_total = chunk["diff"] + oppo_chess_time_total
        return str(hero_chess_time_total), str(oppo_chess_time_total)

    def to_json(self):
        """
        const Game = backbone.Model.extend({
          validate: function(attr) {
            let err = []
            if (attr.players === undefined) err.push("must have players")
            if (attr.winner === undefined) err.push("must have a winner")
            if (attr.gameID === undefined) err.push("must have a gameID")
            if (!Array.isArray(attr.players)) err.push("players must be an array")
            if(err.length) return err  // checkpoint
            if (attr.players.length === 0) err.push("players must not be empty")
            let winnerFound = false
            attr.players.forEach(function(player, idx) {
              if (player.name === undefined) err.push("players[" + idx + "] must have a name")
              if (player.userID === undefined) err.push("players[" + idx + "] must have a userID")
              if (player.deck === undefined) err.push("players[" + idx + "] must have a deck")
              if (player.name === attr.winner) winnerFound = true
            })
            if (!winnerFound) err.push("winner " + attr.winner + " not found in players")
            if(err.length) return err  // checkpoint
          }
        })

        :return:
        """
        assert isinstance(self.hero, Player)
        assert isinstance(self.opponent, Player)

        hero_chess_time_total, oppo_chess_time_total = self.calculate_chess_timer_total()

        # 2022/04/17 self.hero.original_deckがNoneである場合に備えて参考演算子を追加
        hero_obj = {
            "name": self.hero.player_name,
            "userID": self.hero.player_id,
            "deck": self.hero.original_deck.to_min_json() if self.hero.original_deck else {"deckID": None, "poolName": None, "cards": None, "sideboard": None},
            "playedCards": self.hero.played_cards_to_min_json(),
            "mulliganCount": self.hero.mulligan_count,
            "timeSpent": str(hero_chess_time_total),
        }
        opponent_obj = {
            "name": self.opponent.player_name,
            "userID": self.opponent.player_id,
            "deck": self.opponent.seen_cards_to_min_json(),
            "mulliganCount": self.opponent.mulligan_count,
            "timeSpent": str(oppo_chess_time_total),
        }

        # haxx to condense game history logs (8kb record -> 4kb record!)
        # assign each unique blob a numeric ID, then whenever a blob is repeated,
        # drop in the ID instead of the full blob
        #
        # pseudocode for decoding:
        # for event in gameHistory:
        #     for blob in event:
        #         print(historyKey[str(blob)])

        minimized_events = []

        blob_map = {}
        blob_id = 0
        for event_list in self.events:
            minimized_event_list = []
            for blob in event_list:
                if isinstance(blob, dict) and "type" in blob.keys() and blob["type"] == "turn":
                    blob = "turn++"
                if blob not in blob_map.values():
                    blob_map[blob_id] = blob
                    minimized_event_list.append(blob_id)
                    blob_id += 1
                else:
                    for key in blob_map.keys():
                        if blob_map[key] == blob:
                            minimized_event_list.append(key)
                            break  # these in theory will be 1:1, but only add once to be sure
            minimized_events.append(minimized_event_list)

        gameJSON = {
            "players": [hero_obj, opponent_obj],
            "winner": self.winner.player_name,
            "gameID": self.match_id,
            "turnNumber": self.turn_number,
            "elapsedTime": str(datetime.datetime.now() - self.start_time),
            "currentPlayer": self.current_player,
            "currentPhase": self.current_phase,
            "onThePlay": self.on_the_play,
            "opponentStartingRank": self.opponent_rank,
            "eventID": self.event_id,
            "gameHistory": minimized_events,
            "historyKey": blob_map
        }
        gameJSON["game_hash"] = hash_json_object(gameJSON)
        return gameJSON
