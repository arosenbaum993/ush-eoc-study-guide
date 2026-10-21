"""Rebuild the question data and shared styles in quiz.html from index.html.

Run from the repo root after editing questions in index.html or changing PICK:
    python3 tools/build-quiz.py
"""
import json, re

# 10 items per domain, spread across every standard in proportion to the
# study guide's item counts, with 3 multi-point items per domain (13 points each).
PICK = {
    1: "D1-02 D1-03 D1-04 D1-07 D1-09 D1-10 D1-11 D1-12 D1-14 D1-15",
    2: "D2-02 D2-04 D2-06 D2-08 D2-12 D2-14 D2-15 D2-17 D2-18 D2-21",
    3: "D3-01 D3-02 D3-05 D3-06 D3-07 D3-09 D3-12 D3-13 D3-14 D3-16",
    4: "D4-04 D4-05 D4-07 D4-09 D4-12 D4-13 D4-15 D4-17 D4-19 D4-24",
    5: "D5-02 D5-05 D5-08 D5-09 D5-11 D5-14 D5-17 D5-18 D5-20 D5-23",
}

src = open("index.html", encoding="utf-8").read()
style = re.search(r"<style>\n(.*?)</style>", src, re.S).group(1)
style = style.split("\n", 1)[1]  # drop the study guide's layout comment
data = json.loads(re.search(r"^window\.USH_DATA=(.*?);?\s*$", src, re.M).group(1))

doms, cards, qn = [], {}, 0
for d in data:
    ids = PICK[d["n"]].split()
    items = sorted((i for i in d["items"] if i["id"] in ids), key=lambda i: ids.index(i["id"]))
    missing = set(ids) - {i["id"] for i in items}
    assert not missing, f"not in index.html: {missing}"
    for it in items:
        qn += 1
        it["qn"] = qn
    used = {i["std"] for i in items}
    for s in d["stds"]:
        for c in s["cards"]:
            cards[c["id"]] = {"id": c["id"], "name": c["name"], "url": c["url"]}
    doms.append({
        "n": d["n"], "name": d["name"],
        "stds": [{"code": s["code"], "title": s["title"]} for s in d["stds"] if s["code"] in used],
        "items": items,
    })
helps = {i["help"] for d in doms for i in d["items"]}
cards = {k: v for k, v in cards.items() if k in helps}
payload = "window.USH_QUIZ=" + json.dumps({"doms": doms, "cards": cards}, ensure_ascii=False, separators=(",", ":")) + ";"

out = open("quiz.html", encoding="utf-8").read()
def fill(text, begin, end, body):
    i, j = text.index(begin), text.index(end)
    return text[:i + len(begin)] + "\n" + body.rstrip("\n") + "\n" + text[j:]
out = fill(out, "/* BEGIN shared styles: copied from index.html by tools/build-quiz.py */", "/* END shared styles */", style)
out = fill(out, "/* BEGIN quiz data: copied from index.html by tools/build-quiz.py */", "/* END quiz data */", payload)
open("quiz.html", "w", encoding="utf-8").write(out)
print(f"quiz.html: {qn} questions, {sum(i['pts'] for d in doms for i in d['items'])} points")
