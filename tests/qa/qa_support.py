"""QA Agent 运行时支持：语义断言原语（断言说人话，换实现也验得住）。"""
import json
import os

import httpx

BASE = os.environ.get("QA_SUT_URL", "http://127.0.0.1:3020")
TOKEN = os.environ.get("QA_SUT_TOKEN", "")


def _headers():
    h = {"Content-Type": "application/json"}
    if TOKEN:
        h["Authorization"] = "Bearer " + TOKEN
    return h


class Api:
    def __init__(self, base=None):
        self.base = (base or BASE).rstrip("/")
        self.client = httpx.Client(timeout=20.0)

    def get(self, path, **kw):
        return _resp(self.client.get(self.base + path, headers=_headers(), **kw))

    def post(self, path, payload=None, **kw):
        return _resp(self.client.post(self.base + path, headers=_headers(), json=payload or {}, **kw))

    def state(self):
        return self.get("/api/state")

    def call_case(self, cid):
        return {"ok": True, "skipped": True, "why": "no explicit steps", "case": cid}


def _resp(r):
    try:
        body = r.json()
    except Exception:
        body = {"text": r.text[:2000]}
    return {"status": r.status_code, "body": body,
            "ok": bool(isinstance(body, dict) and body.get("ok"))}


def assert_rejected(r, why=""):
    """请求必须被拒绝：HTTP 非 2xx，或 body.ok == False。"""
    assert (r["status"] >= 400) or (r["body"].get("ok") is False), (
        "应被拒绝但被接受了：" + str(why) + " status=" + str(r["status"]) + " body=" + str(r["body"]))


def assert_no_ledger_write(before, after, item_id=None):
    b = json.dumps(before.get("body", {}), sort_keys=True, ensure_ascii=False)
    a = json.dumps(after.get("body", {}), sort_keys=True, ensure_ascii=False)
    assert b == a, "账本发生了预期外的写入（item=%s）" % item_id


api = Api()
