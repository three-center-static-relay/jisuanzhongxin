import json
import os
import re
import sys

import bridge as impl
import bridge_entry as prev


def _by_task_name(text):
    task = os.environ.get("BRIDGE_TASK_ID", "").strip()
    if not task:
        return None
    expected = "three-center-" + re.sub(r"[^A-Za-z0-9._-]+", "-", task)[:48]
    lower = text.lower()
    pos = lower.find(expected.lower())
    if pos < 0:
        return None
    tail = text[pos + len(expected): pos + len(expected) + 500]
    stop = re.search(r"\b(running|pending|created|success|successful|failed)\b", tail, re.I)
    if stop:
        tail = tail[:stop.start()]
    for token in re.findall(r"[A-Za-z0-9._:-]{3,128}", tail):
        candidate = prev._clean_candidate(token)
        if candidate and candidate.lower() != expected.lower():
            return candidate
    return None


def parse_job_id(text):
    raw = str(text or "").strip()
    clean = prev._strip_ansi(raw)
    if not clean:
        prev._report_parse_diag(raw)
        raise RuntimeError("BAIDU_JOB_ID_NOT_FOUND")

    table_id = prev._table_job_id(clean)
    if table_id:
        return table_id

    try:
        found = prev._legacy_parse_job_id(clean)
        candidate = prev._clean_candidate(found)
        if candidate:
            return candidate
    except RuntimeError as exc:
        if str(exc) != "BAIDU_JOB_ID_NOT_FOUND":
            raise

    named = _by_task_name(clean)
    if named:
        return named

    for pattern in (
        r"(?:pipeline[_ -]?id|pipelineId|job[_ -]?id|jobId)\s*(?:[:=：]|\s)\s*['\"]?([A-Za-z0-9._:-]{3,128})",
        r"\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b",
    ):
        m = re.search(pattern, clean, re.I)
        if m:
            candidate = prev._clean_candidate(m.group(1))
            if candidate:
                return candidate

    for url in re.findall(r"https?://[^\s'\"<>]+", clean):
        for pattern in (
            r"(?:pipeline[_-]?id|job[_-]?id)=([A-Za-z0-9._:-]{3,128})",
            r"/(?:pipeline|job|pipelines|jobs)/([A-Za-z0-9._:-]{3,128})(?:[/?#]|$)",
        ):
            m = re.search(pattern, url, re.I)
            if m:
                candidate = prev._clean_candidate(m.group(1))
                if candidate:
                    return candidate

    prev._report_parse_diag(raw)
    raise RuntimeError("BAIDU_JOB_ID_NOT_FOUND")


def parser_selftest():
    old = os.environ.get("BRIDGE_TASK_ID")
    os.environ["BRIDGE_TASK_ID"] = "baidu-circleci-live-20260815d"
    try:
        ansi = (
            "\x1b[32m| name | pipeline_id | status | create_time | url |\x1b[0m\n"
            "| demo | 76543210 | running | 2026-08-15 | https://example/x |"
        )
        assert parse_job_id(ansi) == "76543210"
        row_only = "three-center-baidu-circleci-live-20260815d    pipe-20260815-xyz    running    https://example/x"
        assert parse_job_id(row_only) == "pipe-20260815-xyz"
        assert parse_job_id('{"pipeline_id":"12345678"}') == "12345678"
    finally:
        if old is None:
            os.environ.pop("BRIDGE_TASK_ID", None)
        else:
            os.environ["BRIDGE_TASK_ID"] = old
    print(json.dumps({"ok": True, "suite": "baidu-job-id-ansi-name-parser", "cases": 3}))
    return 0


impl.parse_job_id = parse_job_id


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--selftest-parser":
        sys.exit(parser_selftest())
    try:
        sys.exit(impl.main())
    except Exception as exc:
        task = os.environ.get("BRIDGE_TASK_ID", "").strip()
        op = os.environ.get("BRIDGE_OP", "UNKNOWN").strip().upper()
        if task:
            try:
                impl.callback(task, op, "failed", error=impl.redact_cli(str(exc))[:500], failure_class=impl.failure_class(exc))
            except Exception:
                pass
        print(f"bridge_failed:{impl.failure_class(exc)}", file=sys.stderr)
        sys.exit(1)
