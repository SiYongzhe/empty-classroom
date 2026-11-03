# -*- coding: utf-8 -*-
"""
把多文件版打包成单文件版。
用法：在 axiom-starter 目录下运行  python build_single.py
原理：读 index.html，把 <link> 和 <script src> 换成就地内容。
"""
import re
import os

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, "index.html")
OUT = os.path.join(BASE, "空教室查询-单文件版.html")


def read(rel):
    with open(os.path.join(BASE, rel), encoding="utf-8") as f:
        return f.read()


html = read("index.html")
css = read("assets/style.css")
core = read("assets/core.js")
app = read("assets/app.js")
rooms = read("assets/rooms-real.js")

# 1. 样式内联
html, n1 = re.subn(
    r'<link\s+rel="stylesheet"\s+href="assets/style\.css"\s*/?>',
    lambda m: "<style>\n" + css + "\n</style>",
    html,
)

# 2. 脚本内联（顺序不能乱：rooms-real → core → app）
html, n_rooms = re.subn(
    r'<script\s+src="assets/rooms-real\.js"></script>',
    lambda m: "<script>\n" + rooms + "\n</script>",
    html,
)

html, n2 = re.subn(
    r'<script\s+src="assets/core\.js"></script>',
    lambda m: "<script>\n" + core + "\n</script>",
    html,
)

html, n3 = re.subn(
    r'<script\s+src="assets/app\.js"></script>',
    lambda m: "<script>\n" + app + "\n</script>",
    html,
)

if n1 != 1 or n_rooms != 1 or n2 != 1 or n3 != 1:
    raise SystemExit(f"替换数量不对：css={n1} rooms={n_rooms} core={n2} app={n3}，检查 index.html 里的引用是否被改过")

# 3. 顶部加一行说明，方便以后知道这文件是生成的
html = html.replace(
    "<!DOCTYPE html>",
    "<!DOCTYPE html>\n<!-- 本文件由 build_single.py 自动生成，请勿直接编辑；改源文件后重新运行脚本 -->",
    1,
)

with open(OUT, "w", encoding="utf-8") as f:
    f.write(html)

# 4. 自检：不能残留任何外部引用
leftover = re.findall(r'(?:src|href)="(?!#)([^"]+)"', html)
leftover = [x for x in leftover if not x.startswith("data:")]
print("已生成：", OUT)
print("体积：", os.path.getsize(OUT), "字节")
print("剩余外部引用：", leftover if leftover else "无（可离线使用）")
