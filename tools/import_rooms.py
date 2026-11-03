# -*- coding: utf-8 -*-
"""
把教务处导出的「教室列表」CSV 转成前端数据 assets/rooms-real.js。

用法：
    python tools/import_rooms.py <导出文件.csv> [校区名]

导出来源：教务系统 → 教室查询 → 导出（xlsx 可在 Excel/WPS 里另存为 CSV，UTF-8）。

需要的列（顺序无所谓，按表头匹配）：
    是否存在排课 / 教室代码 / 教室名称 / 所属校区 / 所属教学楼 / 楼层 / 教室类型 / 管理单位 / 上课座位数

只保留目标校区，自动丢掉「校外」「操场」「公用资源」这类不能自习的场所。
"""
import csv
import io
import json
import os
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "rooms-real.js")

DROP_BUILDING = {"校外"}
DROP_TYPE = {"操场", "公用资源"}


def main():
    if len(sys.argv) < 2:
        raise SystemExit("用法：python tools/import_rooms.py <csv路径> [校区名，默认沙河校区]")

    src = sys.argv[1]
    campus = sys.argv[2] if len(sys.argv) > 2 else "沙河校区"

    rows = list(csv.DictReader(io.open(src, encoding="utf-8-sig")))
    if not rows:
        raise SystemExit("CSV 是空的")

    need = {"是否存在排课", "教室名称", "所属校区", "所属教学楼", "楼层", "教室类型", "上课座位数"}
    missing = need - set(rows[0].keys())
    if missing:
        raise SystemExit(f"缺少列：{missing}")

    picked = [r for r in rows if r["所属校区"].strip() == campus]
    if not picked:
        raise SystemExit(f"没有找到校区「{campus}」，现有：{ {r['所属校区'] for r in rows} }")

    rooms = []
    for r in picked:
        name = (r["教室名称"] or "").strip()
        bld = (r["所属教学楼"] or "").replace("沙河校区", "").strip() or "其他"
        rtype = (r["教室类型"] or "").strip() or "未标注"
        if not name or bld in DROP_BUILDING or rtype in DROP_TYPE:
            continue
        try:
            floor = int(float(r["楼层"]))
        except (TypeError, ValueError):
            floor = 0
        try:
            seats = int(float(r["上课座位数"]))
        except (TypeError, ValueError):
            seats = 0
        rooms.append({
            "id": name,
            "bld": bld,
            "floor": floor,
            "seats": seats,
            "type": rtype,
            "hasClass": (r["是否存在排课"] or "").strip() == "是",
        })

    cnt = Counter(x["bld"] for x in rooms)
    buildings = [
        {"id": "b%d" % i, "name": name, "count": n}
        for i, (name, n) in enumerate(cnt.most_common(), 1)
    ]
    bid = {b["name"]: b["id"] for b in buildings}

    out_rooms = [
        {
            "id": x["id"],
            "b": bid[x["bld"]],
            "floor": x["floor"],
            "seats": x["seats"],
            "tags": [x["type"]],
            "hasClass": x["hasClass"],
        }
        for x in rooms
    ]

    payload = {
        "campus": campus,
        "source": "教务处导出教室列表（是否存在排课为导出时的快照）",
        "buildings": buildings,
        "rooms": out_rooms,
    }

    js = (
        "/* 由 tools/import_rooms.py 从教务处导出生成，勿手改 */\n"
        "window.REAL_ROOMS = " + json.dumps(payload, ensure_ascii=False, indent=1) + ";\n"
    )
    io.open(OUT, "w", encoding="utf-8").write(js)

    free = sum(1 for x in out_rooms if not x["hasClass"])
    print(f"校区：{campus}　教室：{len(out_rooms)}　本周无课：{free}　楼栋：{len(buildings)}")
    for b in buildings:
        print(f"  {b['id']:<4} {b['name']:<12} {b['count']}")
    print("输出：", OUT, round(len(js) / 1024, 1), "KB")


if __name__ == "__main__":
    main()
