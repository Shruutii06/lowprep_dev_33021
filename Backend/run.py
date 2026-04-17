"""
Launcher for uvicorn.
Windows: sets ProactorEventLoop so subprocesses work.
Production: reads PORT from environment (required by Railway).
Run with: python run.py
"""
import sys
import asyncio
import os

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
    )
