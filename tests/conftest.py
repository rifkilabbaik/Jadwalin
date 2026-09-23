import os
import tempfile
from pathlib import Path

import pytest

# Arahkan semua path ke folder sementara SEBELUM paket pesanin diimpor.
_TMP = Path(tempfile.mkdtemp(prefix="pesanin-tes-"))
os.environ["PESANIN_DATA_DIR"] = str(_TMP / "data")
os.environ["PESANIN_MEDIA_DIR"] = str(_TMP / "media")
os.environ["PESANIN_INBOX_DIR"] = str(_TMP / "inbox")
os.environ["IG_ACCESS_TOKEN"] = ""
os.environ["IG_USER_ID"] = ""

from pesanin import config, db as db_modul  # noqa: E402

PNG_KECIL = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082"
)


@pytest.fixture
def db(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "MEDIA_DIR", tmp_path / "media")
    monkeypatch.setattr(config, "INBOX_DIR", tmp_path / "inbox")
    db_modul.inisialisasi(f"sqlite:///{tmp_path / 'tes.db'}")
    s = db_modul.buka_sesi()
    yield s
    s.close()


@pytest.fixture
def png():
    return PNG_KECIL
