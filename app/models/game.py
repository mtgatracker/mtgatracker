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

    def do_mulligan(self):
        # TODO: this
        pass

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
        return None, None

    def put_instance_id_in_zone(self, instance_id, owner_id, zone):
        card, current_zone = self.get_location_of_instance(instance_id)
        if current_zone:
            if current_zone != zone:
                # mtga_logger.info("-- iid {} => {}".format(instance_id, card))
                current_zone.transfer_card_to(card, zone)
        else:
            unknown_card = GameCard("unknown", "unknown", [], [], "", "", -1, -1, -1, owner_id, instance_id)
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
        info = {
            "stats": list(reversed(odds_list)),
            "deck_name": self.original_deck.pool_name,
            "total_cards_in_deck": len(current_list),
            "library_contents": [c.to_serializable() for c in current_list],
            "last_drawn": None
        }
        return info

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


class Game(object):
    def __init__(self, match_id, hero, opponent, shared_battlefield, shared_exile, shared_limbo, shared_stack):
        self.match_id = match_id
        self.final = False
        self.winner = None

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

    def game_state(self):
        game_state = {"draw_odds": self.hero.calculate_draw_odds(self.ignored_iids),
                      "opponent_hand": [c.to_serializable() for c in self.opponent.hand.cards]}
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
        print(self.hero.original_deck)
        hero_obj = {
            "name": self.hero.player_name,
            "userID": self.hero.player_id,
            "deck": self.hero.original_deck.to_min_json()
        }
        opponent_obj = {
            "name": self.opponent.player_name,
            "userID": self.opponent.player_id,
            "deck": self.opponent.seen_cards_to_min_json()
        }
        gameJSON = {
            "players": [hero_obj, opponent_obj],
            "winner": self.winner.player_name,
            "gameID": self.match_id,
        }
        gameJSON["game_hash"] = hash_json_object(gameJSON)
        return gameJSON
