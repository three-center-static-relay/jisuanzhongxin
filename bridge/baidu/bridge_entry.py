import json
import os
import re
import sys

import bridge as impl

_legacy_parse_job_id = impl.parse_job_id
_RESERVED = {
    "pipelineid", "jobid", "id", "name", "status", "createtime", "url",
    "pipeline", "job", "running", "pending", "created",
}


def _normalize_key(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def _clean_candidate(value):
    value = str(value or "").strip().strip("'\"")
    if not re.fullmatch(r"[A-Za-z0-9._:-]{3,128}", value):
        return None
    if _normalize_key(value) in _RESERVED:
        return None
    return value


def _table_cells(line):
    if "|" not in line:
        return []
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def _table_job_id(text):
    lines = str(text or "").splitlines()
    for i, line in enumerate(lines):
        headers = _table_cells(line)
        if not headers:
            continue
        normalized = [_normalize_key(cell) for cell in headers]
        index = None
        for key in ("pipelineid", "jobid"):
            if key in normalized:
                index = normalized.index(key)
                break
        if index is None:
            continue
        for row in lines[i + 1:]:
            cells = _table_cells(row)
            if not cells or len(cells) <= index:
                continue
            if [_normalize_key(cell) for cell in cells] == normalized:
                continue
            candidate = _clean_candidate(cells[index])
            if candidate:
                return candidate
    return None


def parse_job_id(text):
    raw = str(text or "").strip()
    if not raw:
        raise RuntimeError("BAIDU_JOB_ID_NOT_FOUND")

    table_id = _table_job_id(raw)
    if table_id:
        return table_id

    try:
        found = _legacy_parse_job_id(raw)
        candidate = _clean_candidate(found)
        if candidate:
            return candidate
    except RuntimeError as exc:
        if str(exc) != "BAIDU_JOB_ID_NOT_FOUND":
            raise

    for line in raw.splitlines():
        if "|" in line:
            continue
        m = re.search(
            r"(?:pipeline[_ -]?id|pipelineId|job[_ -]?id|jobId)\s*(?:[:=]|\s)\s*['\"]?([A-Za-z0-9._:-]{3,128})",
            line,
            re.I,
        )
        if m:
            candidate = _clean_candidate(m.group(1))
            if candidate:
                return candidate

    for url in re.findall(r"https?://[^\s'\"<>]+", raw):
        for pattern in (
            r"(?:pipeline[_-]?id|job[_-]?id)=([A-Za-z0-9._:-]{3,128})",
            r"/(?:pipeline|job|pipelines|jobs)/([A-Za-z0-9._:-]{3,128})(?:[/?#]|$)",
        ):
            m = re.search(pattern, url, re.I)
            if m:
                candidate = _clean_candidate(m.group(1))
                if candidate:
                    return candidate

    raise RuntimeError("BAIDU_JOB_ID_NOT_FOUND")


def parser_selftest():
    cases = [
        (
            "+------+-------------+---------+---------------------+----------------------\n"
            "| name | pipeline_id | status  | create_time         | url                  |\n"
            "+------+-------------+---------+---------------------+----------------------+\n"
            "| demo | 987654321   | running | 2026-08-15 17:00:00 | https://example/x    |\n"
            "+------+-------------+---------+---------------------+----------------------+",
            "987654321",
        ),
        (
            "| name | pipeline_id | status | create_time | url |\n"
            "| demo | 123e4567-e89b-12d3-a456-426614174000 | running | now | https://example/x |",
            "123e4567-e89b-12d3-a456-426614174000",
        ),
        ('{"name":"x","pipeline_id":"12345","status":"running"}', "12345"),
        ("pipeline_id: p-987 status: running", "p-987"),
        ("https://aistudio.baidu.com/pipeline/pipe-42", "pipe-42"),
    ]
    for raw, expected in cases:
        actual = parse_job_id(raw)
        if actual != expected:
            raise AssertionError(f"PARSE_MISMATCH:{actual}:{expected}")
    try:
        parse_job_id("| name | pipeline_id | status |\n| demo | status | running |")
        raise AssertionError("RESERVED_VALUE_NOT_REJECTED")
    except RuntimeError as exc:
        if str(exc) != "BAIDU_JOB_ID_NOT_FOUND":
            raise
    print(json.dumps({"ok": True, "suite": "baidu-job-id-table-parser", "cases": len(cases)}))
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
                impl.callback(
                    task,
                    op,
                    "failed",
                    error=impl.redact_cli(str(exc))[:500],
                    failure_class=impl.failure_class(exc),
                )
            except Exception:
                pass
        print(f"bridge_failed:{impl.failure_class(exc)}", file=sys.stderr)
        sys.exit(1)
