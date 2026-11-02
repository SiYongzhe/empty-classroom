# -*- coding: utf-8 -*-
"""
一键出部署包：单文件版 → site-single.zip（只有 index.html）。
为什么用单文件版部署：多文件版要求 assets/ 目录结构被完整保留，
有些静态托管平台拖 zip 时会漏掉子目录，导致样式 404。
单文件版没有子目录，怎么传都不会错。

用法：python tools/build_deploy.py
产物：build/deploy/site-single.zip
"""
import os
import re
import shutil
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SINGLE = os.path.join(ROOT, "空教室查询-单文件版.html")
OUT_DIR = os.path.join(ROOT, "build", "deploy")
OUT = os.path.join(OUT_DIR, "site-single.zip")


def main():
    if not os.path.exists(SINGLE):
        raise SystemExit("找不到单文件版，先运行 python build_single.py")

    html = open(SINGLE, encoding="utf-8").read()

    # 自检：必须完全自包含
    externals = [
        x for x in re.findall(r'(?:src|href)="(?!#|data:)([^"]+)"', html)
    ]
    if externals:
        raise SystemExit(f"单文件版里还有外部引用，不能这样部署：{externals}")
    if "<style>" not in html or "<script>" not in html:
        raise SystemExit("单文件版缺内联样式或脚本，检查 build_single.py")

    os.makedirs(OUT_DIR, exist_ok=True)
    if os.path.exists(OUT):
        os.remove(OUT)

    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("index.html", html)

    size = os.path.getsize(OUT)
    print(f"已生成：{OUT}")
    print(f"体积：{size / 1024:.1f} KB　条目：index.html（{len(html)} 字符）")
    print("外部引用：无，可直接部署")


if __name__ == "__main__":
    main()
