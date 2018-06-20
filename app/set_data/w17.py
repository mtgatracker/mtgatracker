
import sys
from app.models.card import Card
from app.models.set import Set
import inspect


DivineVerdict = Card("divine_verdict", "Divine Verdict", ['3', 'W'], ['W'], "Instant", "", "W17", "Common", 1, 68414)
GlorySeeker = Card("glory_seeker", "Glory Seeker", ['1', 'W'], ['W'], "Creature", "Human Soldier", "W17", "Common", 2, 68415)
SerraAngel = Card("serra_angel", "Serra Angel", ['3', 'W', 'W'], ['W'], "Creature", "Angel", "W17", "Uncommon", 3, 68416)
StandingTroops = Card("standing_troops", "Standing Troops", ['2', 'W'], ['W'], "Creature", "Human Soldier", "W17", "Common", 4, 68417)
StormfrontPegasus = Card("stormfront_pegasus", "Stormfront Pegasus", ['1', 'W'], ['W'], "Creature", "Pegasus", "W17", "Uncommon", 5, 68418)
VictorysHerald = Card("victorys_herald", "Victory's Herald", ['3', 'W', 'W', 'W'], ['W'], "Creature", "Angel", "W17", "Rare", 6, 68419)
AirElemental = Card("air_elemental", "Air Elemental", ['3', 'U', 'U'], ['U'], "Creature", "Elemental", "W17", "Uncommon", 7, 68420)
CoralMerfolk = Card("coral_merfolk", "Coral Merfolk", ['1', 'U'], ['U'], "Creature", "Merfolk", "W17", "Common", 8, 68421)
DragUnder = Card("drag_under", "Drag Under", ['2', 'U'], ['U'], "Sorcery", "", "W17", "Common", 9, 68422)
Inspiration = Card("inspiration", "Inspiration", ['3', 'U'], ['U'], "Instant", "", "W17", "Common", 10, 68423)
SleepParalysis = Card("sleep_paralysis", "Sleep Paralysis", ['3', 'U'], ['U'], "Enchantment", "Aura", "W17", "Common", 11, 68424)
SphinxofMagosi = Card("sphinx_of_magosi", "Sphinx of Magosi", ['3', 'U', 'U', 'U'], ['U'], "Creature", "Sphinx", "W17", "Rare", 12, 68425)
StealerofSecrets = Card("stealer_of_secrets", "Stealer of Secrets", ['2', 'U'], ['U'], "Creature", "Human Rogue", "W17", "Common", 13, 68426)
TricksoftheTrade = Card("tricks_of_the_trade", "Tricks of the Trade", ['3', 'U'], ['U'], "Enchantment", "Aura", "W17", "Common", 14, 68427)
BloodhunterBat = Card("bloodhunter_bat", "Bloodhunter Bat", ['3', 'B'], ['B'], "Creature", "Bat", "W17", "Common", 15, 68428)
CertainDeath = Card("certain_death", "Certain Death", ['5', 'B'], ['B'], "Sorcery", "", "W17", "Common", 16, 68429)
Nightmare = Card("nightmare", "Nightmare", ['5', 'B'], ['B'], "Creature", "Nightmare Horse", "W17", "Rare", 17, 68430)
RaiseDead = Card("raise_dead", "Raise Dead", ['B'], ['B'], "Sorcery", "", "W17", "Common", 18, 68431)
SengirVampire = Card("sengir_vampire", "Sengir Vampire", ['3', 'B', 'B'], ['B'], "Creature", "Vampire", "W17", "Uncommon", 19, 68432)
UntamedHunger = Card("untamed_hunger", "Untamed Hunger", ['2', 'B'], ['B'], "Enchantment", "Aura", "W17", "Common", 20, 68433)
FalkenrathReaver = Card("falkenrath_reaver", "Falkenrath Reaver", ['1', 'R'], ['R'], "Creature", "Vampire", "W17", "Common", 21, 68434)
ShivanDragon = Card("shivan_dragon", "Shivan Dragon", ['4', 'R', 'R'], ['R'], "Creature", "Dragon", "W17", "Rare", 22, 68435)
ThunderingGiant = Card("thundering_giant", "Thundering Giant", ['3', 'R', 'R'], ['R'], "Creature", "Giant", "W17", "Common", 23, 68436)
GarruksHorde = Card("garruks_horde", "Garruk's Horde", ['5', 'G', 'G'], ['G'], "Creature", "Beast", "W17", "Rare", 24, 68437)
Oakenform = Card("oakenform", "Oakenform", ['2', 'G'], ['G'], "Enchantment", "Aura", "W17", "Common", 25, 68438)
RabidBite = Card("rabid_bite", "Rabid Bite", ['1', 'G'], ['G'], "Sorcery", "", "W17", "Common", 26, 68439)
Rootwalla = Card("rootwalla", "Rootwalla", ['2', 'G'], ['G'], "Creature", "Lizard", "W17", "Common", 27, 68440)
StalkingTiger = Card("stalking_tiger", "Stalking Tiger", ['3', 'G'], ['G'], "Creature", "Cat", "W17", "Common", 28, 68441)
StampedingRhino = Card("stampeding_rhino", "Stampeding Rhino", ['4', 'G'], ['G'], "Creature", "Rhino", "W17", "Common", 29, 68442)
WingSnare = Card("wing_snare", "Wing Snare", ['2', 'G'], ['G'], "Sorcery", "", "W17", "Uncommon", 30, 68443)


clsmembers = [card for name, card in inspect.getmembers(sys.modules[__name__]) if isinstance(card, Card)]
WelcomeDecks2017 = Set("welcome_decks_2017", cards=clsmembers)

