from __future__ import annotations

import hashlib
import json
import urllib.request
import zipfile
from datetime import datetime, timezone

from .settings import (
    DATASET_CITATION,
    DATASET_DOI,
    DATASET_LICENSE,
    DATASET_PAGE,
    DATASET_SLUG,
    DATASET_URL,
    DATASET_VERSION,
    RAW_DIRECTORY,
    WORKBOOK_PATH,
    ZIP_PATH,
)


def sha256(path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    RAW_DIRECTORY.mkdir(parents=True, exist_ok=True)
    if not ZIP_PATH.exists():
        print(f"Baixando {DATASET_URL}")
        temporary = ZIP_PATH.with_suffix(".part")
        urllib.request.urlretrieve(DATASET_URL, temporary)
        temporary.replace(ZIP_PATH)
    if not WORKBOOK_PATH.exists():
        with zipfile.ZipFile(ZIP_PATH) as archive:
            safe_files = [item for item in archive.infolist() if not item.is_dir() and item.filename.lower().endswith(".xlsx")]
            if len(safe_files) != 1:
                raise RuntimeError("O pacote da UCI não contém exatamente uma planilha XLSX.")
            member = safe_files[0]
            if member.file_size > 100_000_000:
                raise RuntimeError("A planilha excede o limite de segurança de 100 MB.")
            member.filename = WORKBOOK_PATH.name
            archive.extract(member, RAW_DIRECTORY)
    manifest = {
        "slug": DATASET_SLUG,
        "version": DATASET_VERSION,
        "source_page": DATASET_PAGE,
        "download_url": DATASET_URL,
        "doi": DATASET_DOI,
        "license": DATASET_LICENSE,
        "citation": DATASET_CITATION,
        "downloaded_at": datetime.now(timezone.utc).isoformat(),
        "zip_sha256": sha256(ZIP_PATH),
        "workbook_sha256": sha256(WORKBOOK_PATH),
        "workbook_bytes": WORKBOOK_PATH.stat().st_size,
    }
    manifest_path = RAW_DIRECTORY / "manifest.local.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Base pronta: {WORKBOOK_PATH}")
    print(f"SHA-256: {manifest['workbook_sha256']}")


if __name__ == "__main__":
    main()
