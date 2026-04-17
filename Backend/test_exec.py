import asyncio
import sys
import tempfile
import os

async def test():
    tmp = tempfile.NamedTemporaryFile(
        mode='w', suffix='.py', delete=False,
        dir=tempfile.gettempdir(), encoding='utf-8'
    )
    tmp.write('print("hello from executor")')
    tmp.close()

    proc = await asyncio.create_subprocess_exec(
        sys.executable, tmp.name,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=os.environ.copy()
    )
    stdout, stderr = await proc.communicate()
    print('OUT:', stdout.decode())
    print('ERR:', stderr.decode())
    print('EXIT:', proc.returncode)
    os.unlink(tmp.name)

asyncio.run(test())
