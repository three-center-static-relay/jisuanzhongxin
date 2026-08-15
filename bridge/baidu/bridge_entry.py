import importlib.metadata
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
_KNOWN_WORDS = {
    "name", "pipeline_id", "pipelineid", "job_id", "jobid", "id", "status",
    "create_time", "createtime", "url", "pipeline", "job", "running", "pending",
    "created", "success", "successful", "submit", "submitted", "task", "code",
    "message", "data", "result", "http", "https", "aistudio", "baidu",
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


def _strip_ansi(value):
    return re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", str(value or ""))


def _skeleton_line(line):
    value = impl.redact_cli(_strip_ansi(line))[:300]
    value = re.sub(r"https?://[^\s'\"<>]+", "<URL>", value, flags=re.I)
    value = re.sub(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", "<UUID>", value, flags=re.I)
    value = re.sub(r"\b[0-9a-f]{24,}\b", lambda m: f"<HEX{len(m.group(0))}>", value, flags=re.I)
    value = re.sub(r"\b\d{4,}\b", lambda m: f"<N{len(m.group(0))}>", value)
    value = re.sub(r"[\u4e00-\u9fff]+", lambda m: f"<C{len(m.group(0))}>", value)

    def word_repl(match):
        token = match.group(0)
        lower = token.lower()
        if lower in _KNOWN_WORDS:
            return lower
        if len(token) <= 2:
            return token.lower()
        return f"<W{len(token)}>"

    value = re.sub(r"[A-Za-z_][A-Za-z0-9_-]*", word_repl, value)
    return value[:300]


def _sdk_source_diag():
    try:
        dist = importlib.metadata.distribution("aistudio-sdk")
        hits = []
        for item in dist.files or []:
            path_text = str(item)
            if not path_text.endswith(".py"):
                continue
            try:
                located = dist.locate_file(item)
                text = located.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue
            lowered = text.lower()
            score = lowered.count("pipeline_id") + lowered.count("prettytable") + lowered.count("submit")
            if score <= 0:
                continue
            hits.append({
                "file": path_text[-120:],
                "pipeline_id": lowered.count("pipeline_id"),
                "job_id": lowered.count("job_id"),
                "prettytable": "prettytable" in lowered,
                "click_echo": lowered.count("click.echo"),
                "print_calls": len(re.findall(r"\bprint\s*\(", text)),
                "json_dumps": "json.dumps" in lowered,
                "tabulate": "tabulate" in lowered,
            })
        hits.sort(key=lambda x: (x["pipeline_id"] + x["job_id"], x["prettytable"], x["click_echo"]), reverse=True)
        return {"version": dist.version, "files": hits[:8]}
    except Exception as exc:
        return {"error": type(exc).__name__}


def _runtime_diag(raw):
    text = _strip_ansi(impl.redact_cli(str(raw or "")))
    lines = text.splitlines()
    numeric_lengths = sorted({len(x) for x in re.findall(r"\b\d{4,}\b", text)})[:12]
    mixed_lengths = sorted({len(x) for x in re.findall(r"\b(?=[A-Za-z0-9._:-]{6,}\b)(?=[A-Za-z0-9._:-]*\d)(?=[A-Za-z0-9._:-]*[A-Za-z])[A-Za-z0-9._:-]+\b", text)})[:12]
    return {
        "chars": len(text),
        "lines": len(lines),
        "pipe_count": text.count("|"),
        "tab_count": text.count("\t"),
        "colon_count": text.count(":"),
        "equal_count": text.count("="),
        "url_count": len(re.findall(r"https?://", text, re.I)),
        "uuid_count": len(re.findall(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", text, re.I)),
        "has_pipeline": bool(re.search(r"pipeline", text, re.I)),
        "has_job": bool(re.search(r"\bjob\b", text, re.I)),
        "has_id": bool(re.search(r"\bid\b|_id|Id\b", text)),
        "numeric_lengths": numeric_lengths,
        "mixed_lengths": mixed_lengths,
        "skeleton": [_skeleton_line(line) for line in lines[:16]],
        "sdk": _sdk_source_diag(),
    }


def _report_parse_diag(raw):
    task = os.environ.get("BRIDGE_TASK_ID", "").strip()
    if not task:
        return
    try:
        impl.callback(
            task,
            "SUBMIT",
            "running",
            stage="aistudio_submit_returned",
            output_diag=_runtime_diag(raw),
        )
    except Exception:
        pass


def parse_job_id(text):
    raw = str(text or "").strip()
    if not raw:
        _report_parse_diag(raw)
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

    stripped = _strip_ansi(raw)
    for line in stripped.splitlines():
        if "|" in line:
            continue
        m = re.search(
            r"(?:pipeline[_ -]?id|pipelineId|job[_ -]?id|jobId)\s*(?:[:=：]|\s)\s*['\"]?([A-Za-z0-9._:-]{3,128})",
            line,
            re.I,
        )
        if m:
            candidate = _clean_candidate(m.group(1))
            if candidate:
                return candidate

    for url in re.findall(r"https?://[^\s'\"<>]+", stripped):
        for pattern in (
            r"(?:pipeline[_-]?id|job[_-]?id)=([A-Za-z0-9._:-]{3,128})",
            r"/(?:pipeline|job|pipelines|jobs)/([A-Za-z0-9._:-]{3,128})(?:[/?#]|$)",
        ):
            m = re.search(pattern, url, re.I)
            if m:
                candidate = _clean_candidate(m.group(1))
                if candidate:
                    return candidate

    _report_parse_diag(raw)
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
