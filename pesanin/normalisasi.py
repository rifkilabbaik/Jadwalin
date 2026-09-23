"""Merapikan link, username, hashtag, dan nomor WhatsApp."""

from __future__ import annotations

import re
from urllib.parse import urlsplit

_RE_IG_POST = re.compile(r"^/(?:[A-Za-z0-9_.]+/)?(?:p|reel|reels|tv)/([A-Za-z0-9_-]+)")
_RE_USERNAME = re.compile(r"^[a-z0-9._]{1,30}$")
_RE_HASHTAG = re.compile(r"^\w{1,100}$")
_RE_WA = re.compile(r"^62\d{8,13}$")
_HOST_IG = {"instagram.com", "instagr.am"}


def permalink(url: str | None) -> str | None:
    """Samakan bentuk link agar duplikat mudah dikenali.

    Link postingan Instagram (/p/, /reel/, /tv/, /username/p/) diubah ke bentuk
    https://www.instagram.com/p/<kode>/ tanpa parameter pelacakan.
    """
    if url is None or not url.strip():
        return None
    url = url.strip()
    if not re.match(r"^[a-z]+://", url, re.I):
        url = "https://" + url
    bagian = urlsplit(url)
    if bagian.scheme.lower() not in ("http", "https") or not bagian.netloc:
        raise ValueError(f"Link tidak valid: {url!r}. Gunakan link lengkap, mis. https://www.instagram.com/p/ABC123/")
    host = bagian.netloc.lower()
    for awalan in ("www.", "m."):
        host = host.removeprefix(awalan)
    if host in _HOST_IG:
        cocok = _RE_IG_POST.match(bagian.path)
        if cocok:
            return f"https://www.instagram.com/p/{cocok.group(1)}/"
        path = bagian.path.rstrip("/")
        return f"https://www.instagram.com{path}/"
    hasil = f"{bagian.scheme.lower()}://{bagian.netloc.lower()}{bagian.path}"
    if bagian.query:
        hasil += f"?{bagian.query}"
    return hasil


def username(teks: str | None) -> str | None:
    """'@Nama.Akun', 'instagram.com/nama.akun' -> 'nama.akun'."""
    if teks is None or not teks.strip():
        return None
    t = teks.strip()
    t = re.sub(r"^(https?://)?(www\.)?instagram\.com/", "", t, flags=re.I)
    t = t.strip("/").split("/")[0].split("?")[0]
    t = t.lstrip("@").lower()
    if not _RE_USERNAME.match(t):
        raise ValueError(
            f"Username Instagram tidak valid: {teks!r}. Hanya huruf, angka, titik, "
            "dan garis bawah (maks. 30 karakter)."
        )
    return t


def hashtag(teks: str) -> str:
    t = teks.strip().lstrip("#").lower().replace(" ", "")
    if not _RE_HASHTAG.match(t):
        raise ValueError(f"Hashtag tidak valid: {teks!r}. Tanpa spasi atau tanda baca.")
    return t


def nomor_wa(teks: str | None) -> str | None:
    """'0812-3456-7890', '+62 812 3456 7890' -> '6281234567890'."""
    if teks is None or not str(teks).strip():
        return None
    t = re.sub(r"[\s\-().]", "", str(teks))
    t = t.removeprefix("+")
    if t.startswith("0"):
        t = "62" + t[1:]
    elif t.startswith("8"):
        t = "62" + t
    if not _RE_WA.match(t):
        raise ValueError(
            f"Nomor WhatsApp tidak valid: {teks!r}. Contoh yang benar: '081234567890' atau '+6281234567890'."
        )
    return t
