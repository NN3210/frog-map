#!/usr/bin/env python3
"""
カエル見つけたマップ — 配布用QRコード生成スクリプト。

依存：segno, reportlab（scripts/requirements.txt）
  pip install -r scripts/requirements.txt

使用例：
  python scripts/make_qr.py --url https://example.github.io/frog-map/
  python scripts/make_qr.py --url https://example.github.io/frog-map/ --src festival_2026,booth_a,day2
  python scripts/make_qr.py --url https://example.github.io/frog-map/ --out-dir docs/qr --title "カエル見つけたマップ"

出力（--out-dir、既定 docs/qr/）：
  qr_<src>.png    1000px 程度、誤り訂正レベル M
  qr_<src>.svg    ベクター版
  qr_print.pdf    A4 縦、1ページ／src。上にタイトル、中央にQR、下にURLと
                   「スマホのカメラで読み取ってください」の案内文。

--src を省略した場合は "?src=" を付けない1枚のみ生成し、ラベルには
"default" を使う（例: qr_default.png）。
"""

import argparse
import os

import segno
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.pdfmetrics import registerFont
from reportlab.pdfgen import canvas

FONT_NAME = "HeiseiKakuGo-W5"  # reportlab 同梱の日本語CIDフォント（外部フォントファイル不要）
TARGET_PX = 1000


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="配布用QRコード（PNG/SVG/印刷用PDF）を生成する")
    parser.add_argument("--url", required=True, help="本番の投稿ページURL（例: https://example.github.io/frog-map/）")
    parser.add_argument(
        "--src",
        default=None,
        help="カンマ区切りの src ラベル（例: festival_2026,booth_a,day2）。省略時は ?src= 無しの1枚のみ生成する。",
    )
    parser.add_argument("--out-dir", default="docs/qr", help="出力先ディレクトリ（既定: docs/qr）")
    parser.add_argument("--title", default="カエル見つけたマップ", help="PDFに載せるタイトル")
    return parser.parse_args(argv)


def build_url(base_url, src):
    if not src:
        return base_url
    sep = "&" if "?" in base_url else "?"
    return f"{base_url}{sep}src={src}"


def make_qr_images(url, out_dir, label):
    """PNG（約1000px）とSVGを書き出し、PNGのパスを返す。"""
    qr = segno.make(url, error="m")
    width_modules, _height_modules = qr.symbol_size(border=4)
    scale = max(1, round(TARGET_PX / width_modules))

    png_path = os.path.join(out_dir, f"qr_{label}.png")
    svg_path = os.path.join(out_dir, f"qr_{label}.svg")
    qr.save(png_path, scale=scale, border=4)
    qr.save(svg_path, scale=10, border=4)
    return png_path


def draw_pdf_page(c, title, url, png_path):
    width, height = A4

    c.setFont(FONT_NAME, 22)
    c.drawCentredString(width / 2, height - 40 * mm, title)

    qr_size = 120 * mm
    qr_x = (width - qr_size) / 2
    qr_y = height / 2 - qr_size / 2 + 10 * mm
    c.drawImage(png_path, qr_x, qr_y, width=qr_size, height=qr_size, preserveAspectRatio=True)

    c.setFont(FONT_NAME, 12)
    c.drawCentredString(width / 2, qr_y - 15 * mm, url)

    c.setFont(FONT_NAME, 15)
    c.drawCentredString(width / 2, qr_y - 28 * mm, "スマホのカメラで読み取ってください")

    c.showPage()


def main(argv=None):
    args = parse_args(argv)
    os.makedirs(args.out_dir, exist_ok=True)

    if args.src:
        labels = [s.strip() for s in args.src.split(",") if s.strip()]
    else:
        labels = [None]

    registerFont(UnicodeCIDFont(FONT_NAME))

    pdf_path = os.path.join(args.out_dir, "qr_print.pdf")
    c = canvas.Canvas(pdf_path, pagesize=A4)

    for src in labels:
        label = src if src else "default"
        url = build_url(args.url, src)
        png_path = make_qr_images(url, args.out_dir, label)
        draw_pdf_page(c, args.title, url, png_path)
        print(f"generated: qr_{label}.png / qr_{label}.svg  (url={url})")

    c.save()
    print(f"generated: {pdf_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
