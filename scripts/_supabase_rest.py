"""Tiny Supabase REST client used by scripts/.

The repo doesn't depend on supabase-py, but `requests` is available, and
PostgREST exposes every table directly. This module wraps the auth headers
and the small subset of operations the scripts need.

Required env vars:
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import requests

URL_ENV = "NEXT_PUBLIC_SUPABASE_URL"
KEY_ENV = "SUPABASE_SERVICE_ROLE_KEY"


class SupabaseConfigError(RuntimeError):
    pass


def load_env_file(path: str = ".env.local") -> None:
    """Best-effort .env.local loader for scripts run on Mac without python-dotenv."""
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            os.environ.setdefault(k, v)


def _config() -> Dict[str, str]:
    load_env_file()
    url = os.environ.get(URL_ENV)
    key = os.environ.get(KEY_ENV)
    if not url:
        raise SupabaseConfigError(f"missing env var {URL_ENV}")
    if not key:
        raise SupabaseConfigError(f"missing env var {KEY_ENV}")
    return {"url": url.rstrip("/"), "key": key}


def _headers(prefer: Optional[str] = None) -> Dict[str, str]:
    cfg = _config()
    h = {
        "apikey": cfg["key"],
        "Authorization": f"Bearer {cfg['key']}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


def select(table: str, params: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    cfg = _config()
    url = f"{cfg['url']}/rest/v1/{table}"
    res = requests.get(url, headers=_headers(), params=params or {}, timeout=30)
    if res.status_code != 200:
        raise RuntimeError(f"GET {table} failed: {res.status_code} {res.text}")
    return res.json()


def insert(table: str, row: Dict[str, Any], on_conflict: Optional[str] = None) -> Dict[str, Any]:
    cfg = _config()
    url = f"{cfg['url']}/rest/v1/{table}"
    params: Dict[str, str] = {}
    prefer = "return=representation"
    if on_conflict:
        params["on_conflict"] = on_conflict
        prefer = "return=representation,resolution=merge-duplicates"
    res = requests.post(
        url,
        headers=_headers(prefer=prefer),
        params=params,
        json=row,
        timeout=30,
    )
    if res.status_code not in (200, 201):
        raise RuntimeError(f"POST {table} failed: {res.status_code} {res.text}")
    data = res.json()
    return data[0] if isinstance(data, list) and data else data


def update(table: str, filters: Dict[str, str], patch: Dict[str, Any]) -> List[Dict[str, Any]]:
    cfg = _config()
    url = f"{cfg['url']}/rest/v1/{table}"
    res = requests.patch(
        url,
        headers=_headers(prefer="return=representation"),
        params=filters,
        json=patch,
        timeout=30,
    )
    if res.status_code not in (200, 204):
        raise RuntimeError(f"PATCH {table} failed: {res.status_code} {res.text}")
    return res.json() if res.text else []
