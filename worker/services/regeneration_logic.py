"""
Defines what each feedback category regenerates vs preserves.
"""

REGENERATION_RULES = {
    "visuals": {
        "regenerate_vo": False,
        "regenerate_music": False,
        "regenerate_sfx": False,
        "rerender_video": True,
    },
    "vo": {
        "regenerate_vo": True,
        "regenerate_music": False,
        "regenerate_sfx": False,
        "rerender_video": True,
    },
    "text": {
        "regenerate_vo": True,  # text change = VO must redo
        "regenerate_music": False,
        "regenerate_sfx": False,
        "rerender_video": True,
    },
    "music": {
        "regenerate_vo": False,
        "regenerate_music": True,
        "regenerate_sfx": False,
        "rerender_video": True,
    },
    "sfx": {
        "regenerate_vo": False,
        "regenerate_music": False,
        "regenerate_sfx": True,
        "rerender_video": True,
    },
}


def merge_regeneration_scope(categories: list[str]) -> dict:
    merged = {
        "regenerate_vo": False,
        "regenerate_music": False,
        "regenerate_sfx": False,
        "rerender_video": False,
    }
    for cat in categories:
        rule = REGENERATION_RULES.get(cat)
        if not rule:
            continue
        for k in merged:
            merged[k] = merged[k] or rule[k]
    return merged
