# -*- coding: utf-8 -*-
"""
一键出部署包。

产物 build/deploy/：
  index.html                     单文件版（样式脚本全内联）
  netlify.toml                   部署配置（函数目录、/api/recommend 跳转）
  netlify/functions/recommend.mjs 服务端代理（API Key 只在这里读取）

以及 build/deploy/site-single.zip（这三个东西打成一个包）。

用法：python tools/build_deploy.py
"""
import os
import re
import shutil
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SINGLE = os.path.join(ROOT, "空教室查询-单文件版.html")
TOML = os.path.join(ROOT, "netlify.toml")
FUNC = os.path.join(ROOT, "netlify", "functions", "recommend.mjs")
OUT_DIR = os.path.join(ROOT, "build", "deploy")
ZIP = os.path.join(OUT_DIR, "site-single.zip")


def main():
    if not os.path.exists(SINGLE):
        raise SystemExit("找不到单文件版，先运行 python build_single.py")
    for p in (TOML, FUNC):
        if not os.path.exists(p):
            raise SystemExit(f"缺少文件：{p}")

    html = open(SINGLE, encoding="utf-8").read()

    # 1. 前端必须完全自包含（除了那个 /api/recommend 接口）
    externals = re.findall(r'(?:src|href)="(?!#|data:)([^"]+)"', html)
    if externals:
        raise SystemExit(f"单文件版里还有外部引用，不能这样部署：{externals}")
    if "<style>" not in html or "<script>" not in html:
        raise SystemExit("单文件版缺内联样式或脚本，检查 build_single.py")

    # 2. 确认前端走的是服务端代理，而不是自己直连模型
    if '"/api/recommend"' not in html:
        raise SystemExit("前端没有启用 PROXY_URL，检查 app.js")

    # 3. 确认函数里没有任何硬编码的 Key
    func_src = open(FUNC, encoding="utf-8").read()
    if re.search(r"sk-[A-Za-z0-9]{10,}", func_src):
        raise SystemExit("函数里疑似硬编码了 API Key，删掉，改用环境变量")

    # 4. 组装
    if os.path.isdir(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    os.makedirs(os.path.join(OUT_DIR, "netlify", "functions"))
    shutil.copy2(SINGLE, os.path.join(OUT_DIR, "index.html"))
    shutil.copy2(TOML, os.path.join(OUT_DIR, "netlify.toml"))
    shutil.copy2(FUNC, os.path.join(OUT_DIR, "netlify", "functions", "recommend.mjs"))

    # 5. 打包（正斜杠路径，避免托管平台校验失败）
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for rel in ("index.html", "netlify.toml", "netlify/functions/recommend.mjs"):
            z.write(os.path.join(OUT_DIR, rel.replace("/", os.sep)), rel)

    print("已生成：", OUT_DIR)
    for rel in ("index.html", "netlify.toml", "netlify/functions/recommend.mjs"):
        p = os.path.join(OUT_DIR, rel.replace("/", os.sep))
        print(f"  {rel:<36} {os.path.getsize(p) / 1024:6.1f} KB")
    print(f"打包：{ZIP}  {os.path.getsize(ZIP) / 1024:.1f} KB")
    print("前端外部引用：无（只调 /api/recommend）")
    print("函数内硬编码 Key：无")


if __name__ == "__main__":
    main()
