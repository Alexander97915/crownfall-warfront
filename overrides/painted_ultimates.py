from pathlib import Path

site = Path(__import__("sys").argv[1])
game = site / "game.js"
source = game.read_text()
for anchor, entry in (
    ("  '8:3':{name:'crystal-freezing-field',ratios:[.9375,.7969]},", "  '9:3':{name:'lina-laguna-blade',frames:4,ext:'webp',ratios:[.92]},"),
    ("  '4:2':{name:'phantom-strike',ratios:[.5391,.8105]},", "  '27:3':{name:'faceless-chronosphere',frames:4,ext:'webp',ratios:[.88]},"),
):
    if entry in source:
        continue
    if anchor not in source:
        raise SystemExit(f"Missing game.js insertion point: {anchor}")
    source = source.replace(anchor, anchor + "\n" + entry, 1)
game.write_text(source)
