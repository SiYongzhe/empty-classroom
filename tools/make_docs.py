# -*- coding: utf-8 -*-
"""
生成参赛资料 PDF。
用法：python tools/make_docs.py <输出目录>

做两件事：
  1. Markdown → docx → pdf
  2. 已有 docx → pdf
转换前统一修表格分页（行不跨页、表头跨页重复）。
"""
import os
import re
import subprocess
import sys

from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

FONT = "Microsoft YaHei"
MONO = "Consolas"
INK = RGBColor(0x1F, 0x25, 0x3D)
BRAND = RGBColor(0x3B, 0x3B, 0xA8)

# LibreOffice Kit（本机固定路径，换机器需要改）
NODE = r"C:\Users\22170\AppData\Local\Programs\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\node\bin\node.exe"
CLI = r"C:\Users\22170\AppData\Local\Programs\DeepSeek Harness\resources\app.asar.unpacked\dsh\node_modules\@deepseek-ai\libreoffice-kit\lib\cli.js"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MD_JOBS = [
    ("README.md", "3-项目说明"),
    ("协作规则.md", "4-团队协作规则"),
    ("部署指南-不用GitHub.md", "5-部署指南"),
    (os.path.join("参赛包", "README-提交模板.md"), "6-提交用README模板"),
    ("演示提示卡.md", "7-演示提示卡"),
    (os.path.join("参赛包", "提交用README.md"), "8-提交用README"),
]

DOCX_JOBS = [
    (os.path.join("参赛包", "Axiom新手参赛执行手册.docx"), "1-新手参赛执行手册"),
    (os.path.join("参赛包", "答辩与演示包-空教室查询.docx"), "2-答辩与演示包"),
]


def _font(run, size=None, bold=None, color=None, mono=False):
    run.font.name = MONO if mono else FONT
    run._element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    if size:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color is not None:
        run.font.color.rgb = color


def _runs(p, text, size=10.5, color=INK):
    for tok in re.split(r"(\*\*[^*]+\*\*|`[^`]+`)", text):
        if not tok:
            continue
        if tok.startswith("**") and tok.endswith("**"):
            _font(p.add_run(tok[2:-2]), size, True, color)
        elif tok.startswith("`") and tok.endswith("`"):
            _font(p.add_run(tok[1:-1]), size - 0.5, False, BRAND, mono=True)
        else:
            _font(p.add_run(tok), size, False, color)


def _shade(p, fill="F6F7FB"):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), fill)
    p._p.get_or_add_pPr().append(shd)


def _left_border(p, color="8A8FA3"):
    bdr = OxmlElement("w:pBdr")
    left = OxmlElement("w:left")
    left.set(qn("w:val"), "single")
    left.set(qn("w:sz"), "10")
    left.set(qn("w:space"), "8")
    left.set(qn("w:color"), color)
    bdr.append(left)
    p._p.get_or_add_pPr().append(bdr)


def md_to_docx(md_path, dst):
    with open(md_path, encoding="utf-8") as f:
        lines = f.read().split("\n")

    doc = Document()
    n = doc.styles["Normal"]
    n.font.name = FONT
    n.font.size = Pt(10.5)
    n.font.color.rgb = INK
    n.element.rPr.rFonts.set(qn("w:eastAsia"), FONT)
    n.paragraph_format.space_after = Pt(5)
    n.paragraph_format.line_spacing = 1.45
    for sec in doc.sections:
        sec.top_margin = Pt(56)
        sec.bottom_margin = Pt(56)
        sec.left_margin = Pt(62)
        sec.right_margin = Pt(62)

    i, total = 0, len(lines)
    while i < total:
        s = lines[i].strip()

        if s.startswith("```"):
            i += 1
            buf = []
            while i < total and not lines[i].strip().startswith("```"):
                buf.append(lines[i])
                i += 1
            i += 1
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(8)
            p.paragraph_format.line_spacing = 1.15
            _shade(p)
            for k, line in enumerate(buf):
                r = p.add_run(line)
                _font(r, 9, False, RGBColor(0x26, 0x29, 0x3F), mono=True)
                if k < len(buf) - 1:
                    r.add_break()
            continue

        if s.startswith("|") and i + 1 < total and re.match(r"^\|[\s:\-|]+\|$", lines[i + 1].strip()):
            header = [c.strip() for c in s.strip("|").split("|")]
            i += 2
            rows = []
            while i < total and lines[i].strip().startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            t = doc.add_table(rows=1, cols=len(header))
            t.style = "Table Grid"
            t.alignment = WD_TABLE_ALIGNMENT.CENTER
            for ci, h in enumerate(header):
                cell = t.rows[0].cells[ci]
                cell.text = ""
                p = cell.paragraphs[0]
                p.paragraph_format.space_after = Pt(2)
                _font(p.add_run(h.replace("**", "")), 9.5, True, RGBColor(0xFF, 0xFF, 0xFF))
                shd = OxmlElement("w:shd")
                shd.set(qn("w:fill"), "3B3BA8")
                cell._tc.get_or_add_tcPr().append(shd)
            for row in rows:
                cells = t.add_row().cells
                for ci, val in enumerate(row[: len(header)]):
                    cells[ci].text = ""
                    p = cells[ci].paragraphs[0]
                    p.paragraph_format.space_after = Pt(2)
                    _runs(p, val, 9.3)
            doc.add_paragraph().paragraph_format.space_after = Pt(1)
            continue

        # 图片：![说明](相对路径)
        mi = re.match(r"^!\[([^\]]*)\]\(([^)]+)\)$", s)
        if mi:
            img = os.path.join(os.path.dirname(md_path), mi.group(2))
            if os.path.exists(img):
                try:
                    doc.add_picture(img, width=Cm(15))
                    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
                except Exception as exc:  # 图片坏了不该让整份文档失败
                    print(f"  [warn] 图片插入失败 {img}: {exc}")
            i += 1
            continue

        m = re.match(r"^(#{1,6})\s+(.*)$", s)
        if m:
            lvl = min(len(m.group(1)), 4)
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(14 if lvl == 1 else 10)
            p.paragraph_format.space_after = Pt(5)
            r = p.add_run(m.group(2).replace("**", ""))
            if lvl == 1:
                _font(r, 16, True, BRAND)
                bdr = OxmlElement("w:pBdr")
                b = OxmlElement("w:bottom")
                b.set(qn("w:val"), "single")
                b.set(qn("w:sz"), "8")
                b.set(qn("w:color"), "D8DAE8")
                bdr.append(b)
                p._p.get_or_add_pPr().append(bdr)
            elif lvl == 2:
                _font(r, 12.5, True, INK)
            else:
                _font(r, 11.5, True, INK)
            i += 1
            continue

        if re.match(r"^-{3,}$", s):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(8)
            bdr = OxmlElement("w:pBdr")
            b = OxmlElement("w:bottom")
            b.set(qn("w:val"), "single")
            b.set(qn("w:sz"), "4")
            b.set(qn("w:color"), "E0E2EE")
            bdr.append(b)
            p._p.get_or_add_pPr().append(bdr)
            i += 1
            continue

        if s.startswith(">"):
            buf = []
            while i < total and lines[i].strip().startswith(">"):
                buf.append(lines[i].strip().lstrip(">").strip())
                i += 1
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(0.4)
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(8)
            p.paragraph_format.line_spacing = 1.5
            _left_border(p)
            for k, line in enumerate(buf):
                _runs(p, line, 10, RGBColor(0x4B, 0x50, 0x63))
                if k < len(buf) - 1:
                    p.add_run().add_break()
            continue

        m = re.match(r"^(?:[-*]|\d+\.)\s+(.*)$", s)
        if m:
            ordered = bool(re.match(r"^\d+\.", s))
            while i < total:
                mm = re.match(r"^(?:[-*]|\d+\.)\s+(.*)$", lines[i].strip())
                if not mm:
                    break
                p = doc.add_paragraph(style="List Number" if ordered else "List Bullet")
                p.paragraph_format.left_indent = Cm(0.6)
                p.paragraph_format.space_after = Pt(2)
                _runs(p, mm.group(1), 10.5)
                i += 1
            continue

        if not s:
            i += 1
            continue

        buf = [s]
        i += 1
        while i < total and lines[i].strip() and not re.match(
            r"^(#{1,6}\s|[-*]\s|\d+\.\s|>|\||```|---)", lines[i].strip()
        ):
            buf.append(lines[i].strip())
            i += 1
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(6)
        _runs(p, " ".join(buf), 10.5)

    doc.save(dst)
    return dst


def fix_tables(src, dst):
    doc = Document(src)
    for t in doc.tables:
        for i, row in enumerate(t.rows):
            trPr = row._tr.get_or_add_trPr()
            trPr.append(OxmlElement("w:cantSplit"))
            if i == 0:
                trPr.append(OxmlElement("w:tblHeader"))
    doc.save(dst)
    return dst


def to_pdf(docx_path, pdf_path):
    # 先删旧文件，否则转换失败时会把上一次的旧产物当成成功
    if os.path.exists(pdf_path):
        os.remove(pdf_path)
    res = subprocess.run(
        [NODE, CLI, "convert", "--input", docx_path, "--output", pdf_path],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    ok = os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 1000
    return ok, ((res.stdout or "") + (res.stderr or "")).strip()


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "build", "pdf")
    os.makedirs(out_dir, exist_ok=True)
    tmp_dir = os.path.join(ROOT, "build", "tmp")
    os.makedirs(tmp_dir, exist_ok=True)

    results = []

    for rel, name in MD_JOBS:
        src = os.path.join(ROOT, rel)
        raw = os.path.join(tmp_dir, name + "_raw.docx")
        fixed = os.path.join(tmp_dir, name + ".docx")
        md_to_docx(src, raw)
        fix_tables(raw, fixed)
        ok, msg = to_pdf(fixed, os.path.join(out_dir, name + ".pdf"))
        results.append((name + ".pdf", ok, msg))

    for rel, name in DOCX_JOBS:
        src = os.path.join(ROOT, rel)
        fixed = os.path.join(tmp_dir, name + ".docx")
        fix_tables(src, fixed)
        ok, msg = to_pdf(fixed, os.path.join(out_dir, name + ".pdf"))
        results.append((name + ".pdf", ok, msg))

    print(f"输出目录：{out_dir}\n")
    bad = 0
    for name, ok, msg in results:
        size = os.path.getsize(os.path.join(out_dir, name)) if ok else 0
        flag = "OK " if ok else "FAIL"
        if not ok:
            bad += 1
            print(f"  {flag} {name}  {msg[:120]}")
        else:
            print(f"  {flag} {name}  {size / 1024:.0f} KB")
    print(f"\n{len(results) - bad}/{len(results)} 成功")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
