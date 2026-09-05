import os
import json
import subprocess
import asyncio
import time
from typing import List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

active_processes = {}
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
SETTINGS_FILE = os.path.join(PROJECT_ROOT, "settings.json")
STATIC_DIR = os.path.join(PROJECT_ROOT, "frontend", "static")

class CustomLink(BaseModel):
    id: str
    name: str
    url: str

class SettingsModel(BaseModel):
    wallpaper_url: str = ""
    moonlight_host: str
    custom_links: List[CustomLink]

def get_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "wallpaper_url" not in data:
                    data["wallpaper_url"] = ""
                return data
        except Exception as e:
            logger.error(f"Error reading settings: {e}")
            
    return {
        "wallpaper_url": "",
        "moonlight_host": "192.168.1.10",
        "custom_links": [
            {"id": "link_google", "name": "Google", "url": "https://google.com"}
        ]
    }

@router.get("/settings")
def read_settings():
    return get_settings()

@router.post("/settings")
def write_settings(settings: SettingsModel):
    try:
        data = json.loads(settings.model_dump_json() if hasattr(settings, 'model_dump_json') else settings.json())
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        return {"status": "success", "message": "Settings saved"}
    except Exception as e:
        logger.error(f"Error saving settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload_wallpaper")
async def upload_wallpaper(request: Request):
    try:
        ext = request.headers.get("X-File-Ext", "jpg")
        ext = ''.join(c for c in ext if c.isalnum())
        if not ext:
            ext = "jpg"
            
        filename = f"bg_{int(time.time())}.{ext}"
        os.makedirs(STATIC_DIR, exist_ok=True)
        filepath = os.path.join(STATIC_DIR, filename)
        
        body = await request.body()
        with open(filepath, "wb") as f:
            f.write(body)
            
        return {"status": "success", "url": f"/static/{filename}"}
    except Exception as e:
        logger.error(f"Error uploading wallpaper: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/launch/{app_id}")
async def launch_app(app_id: str):
    settings = get_settings()
    
    APPS_CONFIG = {
        "youtube": {
            "name": "YouTube",
            "command": ["chromium", "--user-data-dir=/tmp/tv_youtube", "--no-first-run", "--kiosk", "https://www.youtube.com/tv"]
        },
        "moonlight": {
            "name": "Moonlight",
            "command": ["flatpak", "run", "com.moonlight_stream.Moonlight", "stream", settings.get("moonlight_host")]
        }
    }
    
    for link in settings.get("custom_links", []):
        APPS_CONFIG[link["id"]] = {
            "name": link["name"],
            "command": ["chromium", f"--user-data-dir=/tmp/tv_{link['id']}", "--no-first-run", "--kiosk", link["url"]]
        }

    if app_id not in APPS_CONFIG:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if app_id in active_processes and active_processes[app_id].poll() is None:
        return {"status": "success", "message": f"{APPS_CONFIG[app_id]['name']} is already running."}

    config = APPS_CONFIG[app_id]
    
    try:
        logger.info(f"Launching {config['name']} with command: {' '.join(config['command'])}")
        process = subprocess.Popen(
            config['command'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        active_processes[app_id] = process
        return {"status": "success", "message": f"{config['name']} launched"}
    except FileNotFoundError:
        return {"status": "success", "warning": f"Command not found (emulation): {' '.join(config['command'])}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/kill/{app_id}")
async def kill_app(app_id: str):
    process = active_processes.get(app_id)
    if not process or process.poll() is not None:
        return {"status": "success", "message": "Process not found."}
        
    try:
        process.terminate()
        for _ in range(5):
            if process.poll() is not None:
                break
            await asyncio.sleep(0.5)
            
        if process.poll() is None:
            process.kill()
            
        del active_processes[app_id]
        return {"status": "success", "message": "Application closed."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
