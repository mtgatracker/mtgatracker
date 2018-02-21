import util
COLORMAP = {
    "R": "Red",
    "W": "White",
    "B": "Black",
    "U": "Blue",
    "G": "Green"
}


class Card(object):

    def __init__(self, name, pretty_name, cost, card_type, sub_types, set_id, set_number, mtga_id):
        self.name = name
        self.set = set_id
        self.pretty_name = pretty_name
        self.cost = cost
        self.card_type = card_type
        self.sub_types = sub_types
        self.set_number = set_number
        self.mtga_id = mtga_id

    @property
    def colors(self):
        colors = []
        for color_key in COLORMAP.keys():
            if color_key in self.cost:
                colors.append(COLORMAP[color_key])
        if not colors:
            if self.card_type == "Basic Land":
                if "Plains" in self.pretty_name:
                    colors = ["White"]
                if "Swamp" in self.pretty_name:
                    colors = ["Black"]
                if "Forest" in self.pretty_name:
                    colors = ["Green"]
                if "Mountain" in self.pretty_name:
                    colors = ["Red"]
                if "Island" in self.pretty_name:
                    colors = ["Blue"]
            if not colors:
                colors = ["Colorless"]
        return colors

    def is_basic(self):
        import set_data.weird
        return self.mtga_id in [card.mtga_id for card in set_data.weird.BasicLands.cards]

    def __repr__(self):
        return "<Card: '{}' {} {} {}>".format(self.pretty_name, self.colors, self.set, self.mtga_id)

    def __str__(self):
        return self.__repr__()


class GameCard(Card):

    def __init__(self, name, pretty_name, cost, card_type, sub_types, set_id, set_number, mtga_id, owner_seat_id, game_id=-1):
        super().__init__(name, pretty_name, cost, card_type, sub_types, set_id, set_number, mtga_id)
        self.game_id = game_id
        self.owner_seat_id = owner_seat_id

    def __repr__(self):
        if self.mtga_id != -1:
            return "<GameCard: {} {} iid={}>".format(self.name, self.mtga_id, self.game_id)
        else:
            return "<UnknownCard: iid={}>".format(self.game_id)

    def transform_to(self, card_id):
        new_card = util.all_mtga_cards.find_one(card_id)
        self.name = new_card.name
        self.set = new_card.set
        self.set_number = new_card.set_number
        self.mtga_id = new_card.mtga_id