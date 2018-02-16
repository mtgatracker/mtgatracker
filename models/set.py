import re


class Set(object):

    def __init__(self, set_name, cards=None):
        self.set_name = set_name
        self.mtga_ids = set()
        self.cards_in_set = list()

        if cards:
            for card in cards:
                self.add_card(card)

    def add_card(self, card):
        if card.mtga_id in self.mtga_ids:
            raise ValueError("This set already has MTGA ID {}".format(card.mtga_id))
        self.cards_in_set.append(card)
        self.mtga_ids.add(card.mtga_id)


class Pool(object):

    def __init__(self, pool_name, cards=None):
        self.pool_name = pool_name
        if cards is None:
            cards = []
        self.cards = cards

    def group_cards(self):
        grouped = {}
        for card in self.cards:
            if card not in grouped:
                grouped[card] = 0
            grouped[card] += 1
        return grouped

    @classmethod
    def from_sets(cls, pool_name, sets):
        cards = []
        for set in sets:
            for card in set.cards_in_set:
                cards.append(card)
        return Pool(pool_name, cards)

    def search(self, id_or_keyword, direct_match_returns_single=False):
        keyword_as_int = None
        keyword_as_str = str(id_or_keyword)
        try:
            keyword_as_int = int(id_or_keyword)
        except ValueError:
            pass
        results = []
        for card in self.cards:
            if keyword_as_int == card.mtga_id or keyword_as_int == card.set_number:
                return [card]

            keyword_clean = re.sub('[^0-9a-zA-Z_]', '', keyword_as_str.lower())
            if keyword_clean == card.name and direct_match_returns_single:
                return [card]
            if keyword_clean in card.name:
                results.append(card)
        return results
