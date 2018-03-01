import models.card as mcard
import models.set as set
import set_data.rix as rix
import set_data.xln as xln

CinderBarrens = mcard.Card("cinder_barrens", "Cinder Barrens", [], ["B", "R"], "Land", "", "OGW", -1, 62499)

WeirdLands = set.Set("rivals_of_ixalan", cards=[CinderBarrens])

BasicLands = set.Pool("all_basic_lands", cards=[
    rix.Plains, xln.Plains, xln.Plains2, xln.Plains3, xln.Plains4,
    rix.Swamp, xln.Swamp, xln.Swamp2, xln.Swamp2, xln.Swamp4,
    rix.Forest, xln.Forest, xln.Forest2, xln.Forest3, xln.Forest4,
    rix.Mountain, xln.Mountain, xln.Mountain2, xln.Mountain3, xln.Mountain4,
    rix.Island, xln.Island, xln.Island2, xln.Island3, xln.Island4])