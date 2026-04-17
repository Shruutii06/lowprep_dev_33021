"""
Sandboxed code execution — Windows compatible.
Uses subprocess.run in a thread (via asyncio.to_thread) instead of
asyncio.create_subprocess_exec, which fails on Windows SelectorEventLoop.
"""
import sys
import tempfile
import os
import asyncio
import subprocess
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 10
MAX_OUTPUT_BYTES = 8192

BLOCKED_PATTERNS_PYTHON = [
    "import os", "import sys", "import subprocess", "import socket",
    "__import__", "open(", "exec(", "eval(", "compile(",
    "importlib", "shutil", "pathlib", "glob",
]

BLOCKED_PATTERNS_JS = [
    "require(", "process.exit", "child_process", "fs.", "net.",
    "eval(", "Function(", "__proto__",
]


@dataclass
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int
    timed_out: bool
    language: str


def _check_blocked(code: str, patterns: list) -> str | None:
    for pattern in patterns:
        if pattern in code:
            return pattern
    return None


def _run_sync(cmd: list, timeout: int) -> tuple[str, str, int, bool]:
    """Run a command synchronously in a thread. Returns (stdout, stderr, exit_code, timed_out)."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            timeout=timeout,
            env=os.environ.copy(),
        )
        return (
            result.stdout.decode(errors="replace")[:MAX_OUTPUT_BYTES],
            result.stderr.decode(errors="replace")[:MAX_OUTPUT_BYTES],
            result.returncode,
            False,
        )
    except subprocess.TimeoutExpired:
        return ("", "Execution timed out (10s limit).", -1, True)
    except FileNotFoundError as e:
        return ("", str(e), 1, False)


async def execute_code(code: str, language: str) -> ExecutionResult:
    if language == "python":
        blocked = _check_blocked(code, BLOCKED_PATTERNS_PYTHON)
        if blocked:
            return ExecutionResult("", f"SecurityError: '{blocked}' not allowed.", 1, False, language)
        return await _run_python(code)
    elif language == "javascript":
        blocked = _check_blocked(code, BLOCKED_PATTERNS_JS)
        if blocked:
            return ExecutionResult("", f"SecurityError: '{blocked}' not allowed.", 1, False, language)
        return await _run_javascript(code)
    return ExecutionResult("", f"Unsupported language: {language}", 1, False, language)


async def _run_python(code: str) -> ExecutionResult:
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", delete=False,
            dir=tempfile.gettempdir(), encoding="utf-8"
        ) as f:
            f.write(code)
            tmp_path = f.name

        cmd = [sys.executable, tmp_path]
        # asyncio.to_thread runs blocking code in a thread pool — works on ALL platforms
        stdout, stderr, exit_code, timed_out = await asyncio.to_thread(
            _run_sync, cmd, TIMEOUT_SECONDS
        )
        logger.info(f"Python exec done, exit={exit_code}")
        return ExecutionResult(stdout, stderr, exit_code, timed_out, "python")

    except Exception as e:
        logger.error(f"Python exec error: {e}", exc_info=True)
        return ExecutionResult("", f"Internal error: {str(e)}", 1, False, "python")
    finally:
        if tmp_path:
            try: os.unlink(tmp_path)
            except OSError: pass


async def _run_javascript(code: str) -> ExecutionResult:
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".js", delete=False,
            dir=tempfile.gettempdir(), encoding="utf-8"
        ) as f:
            f.write(code)
            tmp_path = f.name

        node_cmd = "node.exe" if sys.platform == "win32" else "node"
        cmd = [node_cmd, tmp_path]
        stdout, stderr, exit_code, timed_out = await asyncio.to_thread(
            _run_sync, cmd, TIMEOUT_SECONDS
        )
        return ExecutionResult(stdout, stderr, exit_code, timed_out, "javascript")

    except Exception as e:
        logger.error(f"JS exec error: {e}", exc_info=True)
        return ExecutionResult("", f"Internal error: {str(e)}", 1, False, "javascript")
    finally:
        if tmp_path:
            try: os.unlink(tmp_path)
            except OSError: pass
