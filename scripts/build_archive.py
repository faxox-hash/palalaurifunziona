from __future__ import annotations

import hashlib
import json
import re
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
INPUT_DIR = ROOT / "input_documents"
OUTPUT_INVOICES_DIR = ROOT / "public" / "invoices"
OUTPUT_DATA_FILE = ROOT / "public" / "data" / "invoices.json"
REPORT_FILE = ROOT / "public" / "data" / "index_report.json"

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover
    PdfReader = None


@dataclass
class SourceGroup:
    key: str
    xml_path: Path | None = None
    pdf_path: Path | None = None
    other_path: Path | None = None


def normalize_filename(name: str) -> str:
    name = name.lower().strip()
    name = re.sub(r"[^a-z0-9._-]+", "-", name)
    name = re.sub(r"-+", "-", name).strip("-.")
    return name or "documento"


def read_bytes_hash(path: Path) -> str:
    h = hashlib.sha1()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def text_or_none(element: ET.Element | None, path: str) -> str | None:
    if element is None:
        return None
    namespaces = {"p": element.tag.split("}")[0].strip("{")} if "}" in element.tag else {}
    node = element.find(path, namespaces) if namespaces else element.find(path)
    if node is None or node.text is None:
        return None
    value = node.text.strip()
    return value or None


def first_not_none(*values: str | None) -> str | None:
    for value in values:
        if value not in (None, ""):
            return value
    return None


def parse_supplier(root: ET.Element) -> str:
    supplier = first_not_none(
        text_or_none(root, ".//CedentePrestatore/DatiAnagrafici/Anagrafica/Denominazione"),
        join_name(
            text_or_none(root, ".//CedentePrestatore/DatiAnagrafici/Anagrafica/Nome"),
            text_or_none(root, ".//CedentePrestatore/DatiAnagrafici/Anagrafica/Cognome"),
        ),
    )
    return supplier or "Fornitore non rilevato"


def join_name(nome: str | None, cognome: str | None) -> str | None:
    if nome and cognome:
        return f"{nome} {cognome}".strip()
    return nome or cognome


def parse_xml_document(xml_path: Path) -> dict[str, Any]:
    tree = ET.parse(xml_path)
    root = tree.getroot()

    supplier = parse_supplier(root)
    invoice_number = text_or_none(root, ".//DatiGeneraliDocumento/Numero")
    invoice_date = text_or_none(root, ".//DatiGeneraliDocumento/Data")
    total_amount = text_or_none(root, ".//DatiGeneraliDocumento/ImportoTotaleDocumento")
    lines = root.findall(".//DettaglioLinee")

    items: list[dict[str, Any]] = []
    for index, line in enumerate(lines, start=1):
        code = first_not_none(
            text_or_none(line, "CodiceArticolo/CodiceValore"),
            text_or_none(line, "NumeroLinea"),
        )
        description = text_or_none(line, "Descrizione") or f"Riga {index}"
        quantity = text_or_none(line, "Quantita")
        unit_price = text_or_none(line, "PrezzoUnitario")
        line_total = first_not_none(text_or_none(line, "PrezzoTotale"), total_amount)
        items.append(
            {
                "code": code,
                "description": description,
                "quantity": quantity,
                "unitPrice": unit_price,
                "amount": line_total,
            }
        )

    if not items:
        items.append(
            {
                "code": None,
                "description": xml_path.stem,
                "quantity": None,
                "unitPrice": None,
                "amount": total_amount,
            }
        )

    return {
        "supplier": supplier,
        "invoice": invoice_number,
        "date": invoice_date,
        "amount": total_amount,
        "items": items,
        "sourceType": "xml",
    }


def extract_pdf_text(pdf_path: Path) -> str:
    if PdfReader is None:
        return ""
    try:
        reader = PdfReader(str(pdf_path))
        return "\n".join((page.extract_text() or "") for page in reader.pages[:5])
    except Exception:
        return ""


def parse_pdf_document(pdf_path: Path) -> dict[str, Any]:
    text = extract_pdf_text(pdf_path)
    supplier = detect_supplier_from_text(text) or supplier_from_filename(pdf_path.stem)
    invoice_number = detect_invoice_number(text) or pdf_path.stem
    invoice_date = detect_date(text)
    amount = detect_amount(text)
    description = first_meaningful_line(text) or pdf_path.stem.replace("-", " ")
    return {
        "supplier": supplier,
        "invoice": invoice_number,
        "date": invoice_date,
        "amount": amount,
        "items": [
            {
                "code": None,
                "description": description,
                "quantity": None,
                "unitPrice": None,
                "amount": amount,
            }
        ],
        "sourceType": "pdf",
    }


def first_meaningful_line(text: str) -> str | None:
    for line in text.splitlines():
        clean = " ".join(line.split()).strip()
        if len(clean) >= 6 and not clean.lower().startswith(("pagina", "page")):
            return clean[:140]
    return None


def supplier_from_filename(stem: str) -> str:
    parts = [p for p in re.split(r"[-_]+", stem) if p]
    if not parts:
        return "Fornitore non rilevato"
    return " ".join(parts[:3]).title()


def detect_supplier_from_text(text: str) -> str | None:
    for line in text.splitlines()[:12]:
        clean = " ".join(line.split()).strip()
        if 4 <= len(clean) <= 80 and not re.search(r"fattura|invoice|data|numero", clean, re.I):
            return clean
    return None


def detect_invoice_number(text: str) -> str | None:
    patterns = [
        r"(?:fattura|invoice|numero|n\.?)[^\n\r]{0,20}?([A-Z0-9][A-Z0-9\-/]{2,})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            return match.group(1).strip()
    return None


def detect_date(text: str) -> str | None:
    match = re.search(r"(20\d{2})[-/.](\d{2})[-/.](\d{2})", text)
    if match:
        return f"{match.group(1)}-{match.group(2)}-{match.group(3)}"
    match = re.search(r"(\d{2})[-/.](\d{2})[-/.](20\d{2})", text)
    if match:
        return f"{match.group(3)}-{match.group(2)}-{match.group(1)}"
    return None


def detect_amount(text: str) -> str | None:
    matches = re.findall(r"(\d{1,3}(?:\.\d{3})*,\d{2})", text)
    return matches[-1] if matches else None


def copy_source_file(path: Path, hash_value: str) -> str:
    OUTPUT_INVOICES_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = normalize_filename(path.stem)
    ext = path.suffix.lower()
    output_name = f"{safe_name}-{hash_value[:8]}{ext}"
    destination = OUTPUT_INVOICES_DIR / output_name
    shutil.copy2(path, destination)
    return f"/invoices/{output_name}"


def build_groups() -> list[SourceGroup]:
    groups: dict[str, SourceGroup] = {}
    for path in INPUT_DIR.rglob("*"):
        if not path.is_file():
            continue
        key = normalize_filename(path.stem)
        group = groups.setdefault(key, SourceGroup(key=key))
        suffix = path.suffix.lower()
        if suffix == ".xml":
            group.xml_path = path
        elif suffix == ".pdf":
            group.pdf_path = path
        else:
            group.other_path = path
    return list(groups.values())


def build_archive() -> tuple[dict[str, Any], dict[str, Any]]:
    OUTPUT_INVOICES_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

    items: list[dict[str, Any]] = []
    document_hashes: set[str] = set()
    duplicates_skipped = 0
    processed_documents = 0
    used_suppliers: set[str] = set()
    used_years: set[str] = set()

    for group in build_groups():
        source_path = group.xml_path or group.pdf_path or group.other_path
        if source_path is None:
            continue

        document_hash = read_bytes_hash(source_path)
        if document_hash in document_hashes:
            duplicates_skipped += 1
            continue
        document_hashes.add(document_hash)
        processed_documents += 1

        pdf_url = copy_source_file(group.pdf_path, read_bytes_hash(group.pdf_path)) if group.pdf_path else None
        xml_url = copy_source_file(group.xml_path, read_bytes_hash(group.xml_path)) if group.xml_path else None

        if group.xml_path:
            parsed = parse_xml_document(group.xml_path)
        elif group.pdf_path:
            parsed = parse_pdf_document(group.pdf_path)
        else:
            parsed = {
                "supplier": supplier_from_filename(source_path.stem),
                "invoice": source_path.stem,
                "date": None,
                "amount": None,
                "items": [{"code": None, "description": source_path.stem, "quantity": None, "unitPrice": None, "amount": None}],
                "sourceType": source_path.suffix.lower().lstrip(".") or "file",
            }

        supplier = parsed.get("supplier") or "Fornitore non rilevato"
        invoice = parsed.get("invoice") or source_path.stem
        date = parsed.get("date")
        amount = parsed.get("amount")
        if date:
            used_years.add(str(date)[:4])
        used_suppliers.add(supplier)

        for index, row in enumerate(parsed.get("items", []), start=1):
            row_id = f"{group.key}-{index}"
            item = {
                "id": row_id,
                "code": row.get("code"),
                "description": row.get("description") or source_path.stem,
                "supplier": supplier,
                "invoice": invoice,
                "date": date,
                "amount": row.get("amount") or amount,
                "type": "Acquisto" if group.xml_path or group.pdf_path else "Documento",
                "quantity": row.get("quantity"),
                "unitPrice": row.get("unitPrice"),
                "pdf": pdf_url,
                "xml": xml_url,
                "filename": source_path.name,
                "documentHash": document_hash,
                "sourceType": parsed.get("sourceType", "file"),
            }
            items.append(item)

    archive = {
        "meta": {
            "archiveVersion": "v2-indexed",
            "lastUpdated": datetime.now().isoformat(timespec="seconds"),
            "totalRows": len(items),
            "totalDocuments": processed_documents,
            "suppliers": sorted(used_suppliers),
            "years": sorted(used_years, reverse=True),
            "duplicatesSkipped": duplicates_skipped,
            "generatedBy": "scripts/build_archive.py",
            "note": "Archivio aggiornato. Per pubblicare online, esegui il deploy del progetto aggiornato."
        },
        "items": items,
    }

    report = {
        "inputDirectory": str(INPUT_DIR),
        "outputDirectory": str(OUTPUT_INVOICES_DIR),
        "generatedAt": archive["meta"]["lastUpdated"],
        "totalRows": len(items),
        "totalDocuments": processed_documents,
        "duplicatesSkipped": duplicates_skipped,
    }
    return archive, report


def main() -> None:
    archive, report = build_archive()
    OUTPUT_DATA_FILE.write_text(json.dumps(archive, ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT_FILE.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Indicizzazione completata")
    print(f"Righe generate: {archive['meta']['totalRows']}")
    print(f"Documenti elaborati: {archive['meta']['totalDocuments']}")
    print(f"Doppioni saltati: {archive['meta']['duplicatesSkipped']}")
    print(f"File indice: {OUTPUT_DATA_FILE}")


if __name__ == "__main__":
    main()
