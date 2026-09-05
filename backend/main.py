import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import logging

from api import core_router, remote_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Smart TV Backend")

# Include modules
app.include_router(core_router, prefix="/api")
app.include_router(remote_router, prefix="/api/remote")

# Directories
base_dir = os.path.dirname(os.path.dirname(__file__))
frontend_dir = os.path.join(base_dir, "frontend")
templates_dir = os.path.join(frontend_dir, "templates")
static_dir = os.path.join(frontend_dir, "static")

# Serve specific pages
@app.get("/")
async def root():
    return FileResponse(os.path.join(templates_dir, "index.html"))

@app.get("/remote")
async def remote_ui():
    return FileResponse(os.path.join(templates_dir, "remote.html"))

# Serve static assets
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
else:
    logger.warning("Static directory not found.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
