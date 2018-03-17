import app.models.card as mcard
import app.models.set as set
import app.set_data.rix as rix
import app.set_data.xln as xln

CinderBarrens = mcard.Card("cinder_barrens", "Cinder Barrens", [], ["B", "R"], "Land", "", "OGW", -1, 62499)
TranquilExpanse = mcard.Card("tranquil_expanse", "Tranquil Expanse", [], ["G", "W"], "Land", "", "OGW", -1, 62523)
MeanderingRiver = mcard.Card("meandering_river", "Meandering River", [], ["U", "W"], "Land", "", "OGW", -1, 62509)
SubmergedBoneyard = mcard.Card("submerged_boneyard", "Submerged Boneyard", [], ["B", "U"], "Land", "", "OGW", -1, 62519)
TimberGorge = mcard.Card("timber_gorge", "Timber Gorge", [], ["G", "R"], "Land", "", "OGW", -1, 62521)

WeirdLands = set.Set("rivals_of_ixalan", cards=[CinderBarrens, TranquilExpanse, MeanderingRiver, TimberGorge,
                                                SubmergedBoneyard])

BasicLands = set.Pool("all_basic_lands", cards=[
    rix.Plains, xln.Plains, xln.Plains2, xln.Plains3, xln.Plains4,
    rix.Swamp, xln.Swamp, xln.Swamp2, xln.Swamp2, xln.Swamp4,
    rix.Forest, xln.Forest, xln.Forest2, xln.Forest3, xln.Forest4,
    rix.Mountain, xln.Mountain, xln.Mountain2, xln.Mountain3, xln.Mountain4,
    rix.Island, xln.Island, xln.Island2, xln.Island3, xln.Island4])