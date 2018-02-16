from models.set import Pool


class Player(object):
    def __init__(self, player_name, player_id, seat, deck_cards=None):
        self.player_name = player_name
        self.player_id = player_id
        self.seat = seat

        self.deck = Pool("{}'s hand".format(self.player_name), deck_cards)
        self.hand = Pool("{}'s hand".format(self.player_name))
        self.graveyard = Pool("{}'s graveyard".format(self.player_name))
        self.exile = Pool("{}'s exile".format(self.player_name))
        self.unknown = Pool("{}'s unknown zones".format(self.player_name))


class Game(object):
    def __init__(self, hero, opponent):
        self.hero = hero
        self.opponent = opponent

        self.identified_game_objects = {}
        self.temp = {}