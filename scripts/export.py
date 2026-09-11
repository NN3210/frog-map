#!/usr/bin/env python3
"""
カエル見つけたマップ — スプレッドシート CSV → QGIS用CSV / GeoJSON 変換。

入力：スプレッドシートから「ファイル → ダウンロード → CSV」で保存した
      UTF-8・ヘッダ行ありの CSV（docs/DESIGN.md §3.1 の列を持つもの）。

出力（--out-dir、既定 output/）：
  records_qgis.csv  UTF-8 BOM付き（Excelで文字化けしない）。列順は入力どおり。
                     lat/lng は数値として書き出す。
  records.geojson   Point の FeatureCollection。properties は lat/lng 以外の全列。
                     lat/lng が空の行はスキップし、件数を標準エラーに出す。

標準ライブラリのみで動作する（csv, json, argparse, os, sys）。

使用例：
  python scripts/export.py scripts/sample/records_sample.csv
  python scripts/export.py records.csv --out-dir output --exclude-status invalid,out_of_area
  python scripts/export.py records.csv --only-source festival_2026
"""

import argparse
import csv
import json
import os
import sys


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="カエル見つけたマップの投稿 CSV を QGIS 用 CSV / GeoJSON に変換する"
    )
    parser.add_argument("input", help="スプレッドシートからダウンロードした CSV")
    parser.add_argument(
        "--out-dir",
        default="output",
        help="出力先ディレクトリ（既定: output/）",
    )
    parser.add_argument(
        "--exclude-status",
        default="",
        help="除外する review_status をカンマ区切りで指定（例: invalid,out_of_area）。"
        "既定は除外なし（全件出力）。",
    )
    parser.add_argument(
        "--only-source",
        default=None,
        help="指定した source の行だけを出力する（例: festival_2026）。",
    )
    return parser.parse_args(argv)


def read_rows(input_path):
    # utf-8-sig にしておくと、BOM付きCSVが渡されても先頭列名が壊れない
    with open(input_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        rows = list(reader)
    return fieldnames, rows


def filter_rows(rows, exclude_statuses, only_source):
    filtered = []
    for row in rows:
        status = (row.get("review_status") or "").strip()
        if status in exclude_statuses:
            continue
        if only_source is not None and (row.get("source") or "") != only_source:
            continue
        filtered.append(row)
    return filtered


def to_number_or_empty(value):
    if value is None:
        return ""
    value = value.strip()
    if value == "":
        return ""
    try:
        return float(value)
    except ValueError:
        return value  # 数値化できない値はそのまま残す（データ異常の可視化のため）


def write_qgis_csv(path, fieldnames, rows):
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            out_row = dict(row)
            if "lat" in out_row:
                out_row["lat"] = to_number_or_empty(out_row.get("lat"))
            if "lng" in out_row:
                out_row["lng"] = to_number_or_empty(out_row.get("lng"))
            writer.writerow(out_row)


def write_geojson(path, fieldnames, rows):
    skipped = 0
    features = []
    prop_fields = [f for f in fieldnames if f not in ("lat", "lng")]

    for row in rows:
        lat_raw = (row.get("lat") or "").strip()
        lng_raw = (row.get("lng") or "").strip()
        if lat_raw == "" or lng_raw == "":
            skipped += 1
            continue
        try:
            lat = float(lat_raw)
            lng = float(lng_raw)
        except ValueError:
            skipped += 1
            continue

        properties = {field: row.get(field, "") for field in prop_fields}
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lng, lat]},
                "properties": properties,
            }
        )

    geojson = {"type": "FeatureCollection", "features": features}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    return skipped


def main(argv=None):
    args = parse_args(argv)

    exclude_statuses = {
        s.strip() for s in args.exclude_status.split(",") if s.strip()
    }

    fieldnames, rows = read_rows(args.input)
    if not fieldnames:
        print("error: 入力CSVにヘッダ行が見つかりません", file=sys.stderr)
        return 1

    rows = filter_rows(rows, exclude_statuses, args.only_source)

    os.makedirs(args.out_dir, exist_ok=True)

    qgis_path = os.path.join(args.out_dir, "records_qgis.csv")
    geojson_path = os.path.join(args.out_dir, "records.geojson")

    write_qgis_csv(qgis_path, fieldnames, rows)
    skipped = write_geojson(geojson_path, fieldnames, rows)

    print(f"records_qgis.csv: {len(rows)} 行を書き出しました ({qgis_path})", file=sys.stderr)
    print(
        f"records.geojson: {len(rows) - skipped} 件を書き出し、lat/lng が空の {skipped} 行をスキップしました ({geojson_path})",
        file=sys.stderr,
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
