from __future__ import annotations

import json
import re
from pathlib import Path

from PIL import Image, ImageOps
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "app" / "data"
ASSET_DIR = ROOT / "app" / "assets" / "products"

TABLES = [
    {
        "kind": "vigente",
        "label": "Tabela vigente",
        "pdf": ROOT / "PDF-20260710T172416Z-2-001" / "PDF" / "Tabela 64R6B Dermiwil e BabyGo.pdf",
        "images": ROOT / "Tabela Vigente-20260710T170757Z-2-001" / "Tabela Vigente",
    },
    {
        "kind": "promo",
        "label": "Tabela promocional",
        "pdf": ROOT / "PDF-20260710T172416Z-2-001" / "PDF" / "Tabela 64R3A Dermiwil e BabyGo PROMO.pdf",
        "images": ROOT / "Tabela Promo-20260710T170801Z-2-001" / "Tabela Promo",
    },
]


ROW_RE = re.compile(
    r"^(?P<code>\d{4,5})(?P<body>.*?)(?P<price>\d+\.\d{2})\s*"
    r"(?P<box>\d{1,3})(?P<ipi>\d+\.\d{2})%(?P<delivery>.+)$"
)


def clean_text(value: str) -> str:
    value = re.sub(r"\s+", " ", value)
    value = value.replace("Ref.Descrição do Produto Coleções Nome da ColeçãoR$ VendaCX IPI Entrega", "")
    return value.strip()


def code_key(value: str) -> str:
    return str(int(value))


def image_map(images_dir: Path) -> dict[str, Path]:
    candidates: dict[str, list[Path]] = {}
    for path in sorted(images_dir.iterdir()):
        if not path.is_file() or path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue
        match = re.match(r"0*(\d+)", path.stem)
        if match:
            candidates.setdefault(code_key(match.group(1)), []).append(path)

    def score(path: Path) -> tuple[int, int, str]:
        stem = path.stem.lower()
        has_parentheses = "(" in stem or ")" in stem
        has_only_code = bool(re.fullmatch(r"0*\d+", stem))
        has_plain_jpg_label = bool(re.fullmatch(r"0*\d+-jpg", stem))
        return (
            0 if has_only_code else 1 if has_plain_jpg_label else 2,
            1 if has_parentheses else 0,
            path.name.lower(),
        )

    return {key: sorted(paths, key=score)[0] for key, paths in candidates.items()}


def extract_rows(pdf_path: Path) -> list[dict]:
    reader = PdfReader(str(pdf_path))
    rows: list[dict] = []

    for page in reader.pages:
        text = page.extract_text() or ""
        for raw_line in text.splitlines():
            line = clean_text(raw_line)
            if not line or not re.match(r"^\d{4,5}", line):
                continue

            match = ROW_RE.match(line)
            if not match:
                continue

            body = clean_text(match.group("body"))
            delivery = clean_text(match.group("delivery"))
            code = match.group("code")

            rows.append(
                {
                    "code": code,
                    "codeKey": code_key(code),
                    "description": body,
                    "price": float(match.group("price")),
                    "boxQty": int(match.group("box")),
                    "ipi": float(match.group("ipi")),
                    "delivery": delivery,
                }
            )

    return rows


def optimize_image(source: Path, table_kind: str, code_key_value: str) -> str:
    target_dir = ASSET_DIR / table_kind
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / f"{code_key_value}.webp"

    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        return target.relative_to(ROOT / "app").as_posix()

    with Image.open(source) as img:
        img = ImageOps.exif_transpose(img)
        if img.mode not in {"RGB", "RGBA"}:
            img = img.convert("RGB")
        img.thumbnail((760, 760), Image.Resampling.LANCZOS)
        img.save(target, "WEBP", quality=72, method=1)

    return target.relative_to(ROOT / "app").as_posix()


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    products: list[dict] = []
    report: dict[str, dict] = {}

    for table in TABLES:
        rows = extract_rows(table["pdf"])
        images = image_map(table["images"])
        seen_codes = {row["codeKey"] for row in rows}
        display_codes_by_key = {row["codeKey"]: row["code"] for row in rows}

        for row in rows:
            image = images.get(row["codeKey"])
            row.update(
                {
                    "id": f"{table['kind']}-{row['codeKey']}",
                    "tableKind": table["kind"],
                    "tableLabel": table["label"],
                    "image": optimize_image(image, table["kind"], row["codeKey"]) if image else "",
                }
            )
            products.append(row)

        report[table["kind"]] = {
            "tableLabel": table["label"],
            "productsInPdf": len(rows),
            "images": len(images),
            "matchedImages": sum(1 for row in rows if row["codeKey"] in images),
            "missingImages": [
                display_codes_by_key[key] for key in sorted(seen_codes - set(images), key=int)
            ],
            "extraImages": sorted(set(images) - seen_codes, key=int),
        }

    products.sort(key=lambda item: (item["tableKind"] != "promo", int(item["codeKey"])))

    (OUT_DIR / "products.json").write_text(
        json.dumps(products, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (OUT_DIR / "import-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"Produtos gerados: {len(products)}")
    for kind, details in report.items():
        print(
            f"{kind}: {details['productsInPdf']} itens, "
            f"{details['matchedImages']} imagens vinculadas, "
            f"{len(details['missingImages'])} sem imagem"
        )


if __name__ == "__main__":
    main()
