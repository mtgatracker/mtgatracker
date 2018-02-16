class Card(object):

    def __init__(self, name, set, set_number, mtga_id):
        self.name = name
        self.set = set
        self.set_number = set_number
        self.mtga_id = mtga_id

    def __repr__(self):
        return "<Card: {} {} {}>".format(self.name, self.set, self.mtga_id)