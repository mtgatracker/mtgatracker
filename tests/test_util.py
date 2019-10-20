import pytest

from util import rank_rarity, rank_colors


@pytest.mark.parametrize("rarity,rank", 
    [("Mythic", 100), ("Rare", 80), ("Uncommon", 50), ("Common", 20), ("Other", 0)]
)
def test_rank_rarity(rarity, rank):
    assert rank == rank_rarity(rarity)


@pytest.mark.parametrize("colors,rank",
    [
        ("UR", 10),
        ("WU", 3),
        ("UB", 6),
        ("RB", 12),
        ("RG", 24),
        ("WB", 5),
        ("WR", 9),
        ("UBR", 14),
        ("WUBRG", 31),
        ("", 33)
    ]
)
def test_rank_colors(colors, rank):
    assert rank == rank_colors(colors)
