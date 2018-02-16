import re
from models.card import Card


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

    def __repr__(self):
        return "<Pool {}: {} cards>".format(self.pool_name, len(self.cards))

    def group_cards(self):
        grouped = {}
        for card in self.cards:
            if card not in grouped:
                grouped[card] = 0
            grouped[card] += 1
        return grouped

    def transfer_all_to(self, other_pool):
        for card in self.cards:
            other_pool.cards.append(card)
        while self.cards:
            self.cards.pop()

    def transfer_cards_to(self, cards, other_pool):
        # TODO: make this "session safe" (ie if we error on the third card, we should not have transferred the first 2)
        for card in cards:
            self.transfer_card_to(card, other_pool)

    def transfer_card_to(self, card, other_pool):
        # TODO: make this atomic, somehow?
        res = card
        if not isinstance(card, Card):  # allow you to pass in cards or ids or searches
            res = self.find_one(card)
        self.cards.remove(res)
        other_pool.cards.append(res)

    @classmethod
    def from_sets(cls, pool_name, sets):
        cards = []
        for set in sets:
            for card in set.cards_in_set:
                cards.append(card)
        return Pool(pool_name, cards)

    def find_one(self, id_or_keyword):
        result = set(self.search(id_or_keyword))
        if len(result) < 1:
            raise ValueError("Pool does not contain {}".format(id_or_keyword))
        elif len(result) > 1:
            raise ValueError("Pool search '{}' not narrow enough, got: {}".format(id_or_keyword, result))
        return result.pop()

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
