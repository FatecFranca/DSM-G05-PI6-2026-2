from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
load_dotenv(REPOSITORY_ROOT / "apps" / "api" / ".env")

DATASET_SLUG = "uci-online-retail-ii"
DATASET_VERSION = "2009-12_to_2011-12"
DATASET_URL = "https://archive.ics.uci.edu/static/public/502/online+retail+ii.zip"
DATASET_PAGE = "https://archive.ics.uci.edu/dataset/502/online+retail+ii"
DATASET_DOI = "10.24432/C5CG6D"
DATASET_LICENSE = "CC BY 4.0"
DATASET_CITATION = "Chen, D. (2012). Online Retail II. UCI Machine Learning Repository."
RAW_DIRECTORY = REPOSITORY_ROOT / "data" / "raw" / DATASET_SLUG
ZIP_PATH = RAW_DIRECTORY / "online-retail-ii.zip"
WORKBOOK_PATH = RAW_DIRECTORY / "online_retail_II.xlsx"
MODEL_DIRECTORY = REPOSITORY_ROOT / "models" / DATASET_SLUG


def database_url() -> str:
    value = os.getenv("DATABASE_URL")
    if not value:
        raise RuntimeError("DATABASE_URL não encontrada. Configure apps/api/.env.")
    return value
