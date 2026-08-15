import json
import os
import re
import sys

import bridge as impl
import bridge_entry as prev


def expected_task_name(task=None):
    task = str(task if task is not None else os.environ.get("BRIDGE_TASK_ID", "")).strip()
    if not task:
        return ""
    return "three-center-" + re.sub(r"[^A-Za-z0-9._-]+", "-", task)[:48]


def _table_pipeline_id(text, expected_name=""):
    lines = str(text or "").splitlines()
    expected_lower = str(expected_name or "").lower()
    for i, line in enumerate(lines):
        headers = prev._table_cells(line)
        if not headers:
            continue
        normalized = [prev._normalize_key(cell) for cell in headers]
        id_index = None
        for key in ("pid", "pipelineid", "jobid"):
            if key in normalized:
                id_index = normalized.index(key)
                break
        if id_index is None:
            continue
        name_index = normalized.index("name") if "name" in normalized else None
        for row in lines[i + 1:]:
            cells = prev._table_cells(row)
            if not cells or len(cells) <= id_index:
                continue
            row_norm = [prev._normalize_key(cell) for cell in cells]
            if row_norm == normalized:
                continue
            if name_index is not None:
                if len(cells) <= name_index:
                    continue
                if expected_lower and cells[name_index].strip().lower() != expected_lower:
                    continue
            candidate = prev._clean_candidate(cells[id_index])
            if candidate:
                return candidate
    return None


def _by_task_name(text):
    expected = expected_task_name()
    if not expected:
        return None
    for line in str(text or "").splitlines():
        if expected.lower() not in line.lower():
            continue
        cells = prev._table_cells(line)
        if cells:
            for cell in cells:
                if cell.strip().lower() == expected.lower():
                    continue
            # Table output is handled by _table_pipeline_id; do not guess a
            # neighboring status/url cell here.
            continue
        tokens = re.findall(r"[A-Za-z0-9._:-]{3,128}", line)
        index = next((i for i, token in enumerate(tokens) if token.lower() == expected.lower()), None)
        if index is None:
            continue
        # AI Studio 0.3.8 emits pid before name. Prefer tokens before the task
        # name; retain an after-name fallback for older row-only formats.
        ordered = list(reversed(tokens[:index])) + tokens[index + 1:]
        for token in ordered:
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

    expected = expected_task_name()
    table_id = _table_pipeline_id(clean, expected)
    if table_id:
        return table_id

    # Preserve the older table parser for output variants whose header is
    # pipeline_id/job_id but whose name column is absent.
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
        r"(?:\bpid\b|pipeline[_ -]?id|pipelineId|job[_ -]?id|jobId)\s*(?:[:=：]|\s)\s*['\"]?([A-Za-z0-9._:-]{3,128})",
        r"\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b",
    ):
        m = re.search(pattern, clean, re.I)
        if m:
            candidate = prev._clean_candidate(m.group(1))
            if candidate:
                return candidate

    for url in re.findall(r"https?://[^\s'\"<>]+", clean):
        for pattern in (
            r"(?:pipeline[_-]?id|job[_-]?id|pid)=([A-Za-z0-9._:-]{3,128})",
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
    expected = expected_task_name()
    try:
        official = (
            "+----------+------------------------------------------------------+---------+----------------------+---------------------+\n"
            "| pid      | name                                                 | status  | url                  | createTime          |\n"
            "+----------+------------------------------------------------------+---------+----------------------+---------------------+\n"
            f"| 98765432 | {expected} | running | https://example/x    | 2026-08-15 17:00:00 |\n"
            "+----------+------------------------------------------------------+---------+----------------------+---------------------+"
        )
        assert parse_job_id(official) == "98765432"
        ansi = (
            "\x1b[32m| name | pipeline_id | status | create_time | url |\x1b[0m\n"
            f"| {expected} | 76543210 | running | 2026-08-15 | https://example/x |"
        )
        assert parse_job_id(ansi) == "76543210"
        row_only = f"pipe-20260815-xyz    {expected}    running    https://example/x"
        assert parse_job_id(row_only) == "pipe-20260815-xyz"
        assert parse_job_id('{"pipeline_id":"12345678"}') == "12345678"
        assert parse_job_id("pid: 24681357 status: running") == "24681357"
    finally:
        if old is None:
            os.environ.pop("BRIDGE_TASK_ID", None)
        else:
            os.environ["BRIDGE_TASK_ID"] = old
    print(json.dumps({"ok": True, "suite": "baidu-pid-parser-v3", "cases": 5}))
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
