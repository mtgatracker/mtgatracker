import pytest

from util import rank_rarity


@pytest.mark.parametrize("rarity,rank", 
    [("Mythic", 100), ("Rare", 80), ("Uncommon", 50), ("Common", 20), ("Other", 0)]
)
def test_rank_rarity(rarity, rank):
    assert rank == rank_rarity(rarity)
