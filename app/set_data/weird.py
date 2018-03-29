import app.models.card as mcard
import app.models.set as set
import app.set_data.rix as rix
import app.set_data.xln as xln

CinderBarrens = mcard.Card("cinder_barrens", "Cinder Barrens", [], ["B", "R"], "Land", "", "OGW", -1, 62499)
TranquilExpanse = mcard.Card("tranquil_expanse", "Tranquil Expanse", [], ["G", "W"], "Land", "", "OGW", -1, 62523)
MeanderingRiver = mcard.Card("meandering_river", "Meandering River", [], ["U", "W"], "Land", "", "OGW", -1, 62509)
SubmergedBoneyard = mcard.Card("submerged_boneyard", "Submerged Boneyard", [], ["B", "U"], "Land", "", "OGW", -1, 62519)
TimberGorge = mcard.Card("timber_gorge", "Timber Gorge", [], ["G", "R"], "Land", "", "OGW", -1, 62521)

# TODO: why are these offset more than the others?
FoulOrchardAKH = mcard.Card("foul_orchard", "Foul Orchard", [], ['B', 'G'], "Land", "", "AKH", 279, 65461)
CinderBarrensAKH = mcard.Card("cinder_barrens", "Cinder Barrens", [], ['B', 'R'], "Land", "", "AKH", 280, 65463)
ForsakenSanctuaryAKH = mcard.Card("forsaken_sanctuary", "Forsaken Sanctuary", [], ['W', 'B'], "Land", "", "AKH", 281, 65465)
HighlandLakeAKH = mcard.Card("highland_lake", "Highland Lake", [], ['U', 'R'], "Land", "", "AKH", 282, 65467)
MeanderingRiverAKH = mcard.Card("meandering_river", "Meandering River", [], ['W', 'U'], "Land", "", "AKH", -1, 65469)
SubmergedBoneyardAKH = mcard.Card("submerged_boneyard", "Submerged Boneyard", [], ['U', 'B'], "Land", "", "AKH", 284, 65471)
TimberGorgeAKH = mcard.Card("timber_gorge", "Timber Gorge", [], ['R', 'G'], "Land", "", "AKH", 285, 65473)
TranquilExpanseAKH = mcard.Card("tranquil_expanse", "Tranquil Expanse", [], ['G', 'W'], "Land", "", "AKH", 286, 65475)
WoodlandStreamAKH = mcard.Card("woodland_stream", "Woodland Stream", [], ['G', 'U'], "Land", "", "AKH", 287, 65477)

FullArtPlainsAKH = mcard.Card("plains", "Plains", [], ['W'], "Basic Land", "Plains", "AKH", 251, 65433)
FullArtIslandAKH = mcard.Card("island", "Island", [], ['U'], "Basic Land", "Island", "AKH", 250, 65435)
FullArtSwampAKH = mcard.Card("swamp", "Swamp", [], ['B'], "Basic Land", "Swamp", "AKH", 252, 65437)
FullArtMountainAKH = mcard.Card("mountain", "Mountain", [], ['W'], "Basic Land", "Mountain", "AKH", 253, 65439)
FullArtForestAKH = mcard.Card("forest", "Forest", [], ['G'], "Basic Land", "Forest", "AKH", 254, 65441)


WeirdLands = set.Set("weird_lands", cards=[CinderBarrens, TranquilExpanse, MeanderingRiver, TimberGorge,
                                           SubmergedBoneyard, FoulOrchardAKH, CinderBarrensAKH,
                                           ForsakenSanctuaryAKH, HighlandLakeAKH, MeanderingRiverAKH,
                                           SubmergedBoneyardAKH, TimberGorgeAKH, TranquilExpanseAKH,
                                           WoodlandStreamAKH, FullArtPlainsAKH, FullArtIslandAKH, FullArtSwampAKH,
                                           FullArtMountainAKH, FullArtForestAKH])


BasicLands = set.Pool("all_basic_lands", cards=[
    rix.Plains, xln.Plains, xln.Plains2, xln.Plains3, xln.Plains4,
    rix.Swamp, xln.Swamp, xln.Swamp2, xln.Swamp2, xln.Swamp4,
    rix.Forest, xln.Forest, xln.Forest2, xln.Forest3, xln.Forest4,
    rix.Mountain, xln.Mountain, xln.Mountain2, xln.Mountain3, xln.Mountain4,
    rix.Island, xln.Island, xln.Island2, xln.Island3, xln.Island4])