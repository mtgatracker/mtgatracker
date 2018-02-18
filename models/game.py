import models.set as mset
from models.card import GameCard


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

    def get_location_of_instance(self, instance_id):
        for zone in self.all_zones:
            for card in zone.cards:
                if card.game_id == instance_id:
                    return card, zone
        return None, None

    def put_instance_id_in_zone(self, instance_id, owner_id, zone):
        if instance_id in [222, 224]:
            print(342)
        card, current_zone = self.get_location_of_instance(instance_id)
        if current_zone:
            if current_zone != zone:
                print("-- iid {} => {}".format(instance_id, card))
                current_zone.transfer_card_to(card, zone)
        else:
            unknown_card = GameCard("unknown", -1, -1, -1, owner_id, instance_id)
            print("-- iid {} => {}".format(instance_id, unknown_card))
            zone.cards.append(unknown_card)


class Game(object):
    def __init__(self, hero, opponent, shared_battlefield, shared_exile, shared_limbo, shared_stack):
        self.hero = hero
        assert isinstance(self.hero, Player)
        self.opponent = opponent
        assert isinstance(self.opponent, Player)
        self.battlefield = shared_battlefield
        self.exile = shared_exile
        self.limbo = shared_limbo
        self.stack = shared_stack

        self.ignored_iids = set()
        self.temp = {}

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
        if self.hero.seat == seat_id:
            return self.hero
        elif self.opponent.seat == seat_id:
            return self.opponent
        else:
            print("NOTHING TO RETURN OH NO")

    def find_card_by_iid(self, instance_id):
        assert isinstance(self.hero, Player)
        card, zone = self.hero.get_location_of_instance(instance_id)
        if card:
            return card
        card, zone = self.opponent.get_location_of_instance(instance_id)
        if card:
            return card
        return None