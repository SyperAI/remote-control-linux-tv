import os
import json
import subprocess
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Smart TV Backend")

active_processes = {}
SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "settings.json")

class SettingsModel(BaseModel):
    website_url: str
    moonlight_host: str

def get_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading settings: {e}")
    return {"website_url": "https://ya.ru", "moonlight_host": "192.168.1.10"}

def save_settings(settings: dict):
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=4, ensure_ascii=False)

@app.get("/api/settings")
def read_settings():
    return get_settings()

@app.post("/api/settings")
def write_settings(settings: SettingsModel):
    try:
        data = settings.model_dump()
    except AttributeError:
        data = settings.dict()
    save_settings(data)
    return {"status": "success", "message": "Настройки сохранены"}

@app.post("/api/launch/{app_id}")
async def launch_app(app_id: str):
    settings = get_settings()
    
    APPS_CONFIG = {
        "youtube": {
            "name": "YouTube",
            "command": ["firefox", "--kiosk", "https://www.youtube.com/tv"]
        },
        "website": {
            "name": "Браузер",
            "command": ["firefox", "--kiosk", settings.get("website_url")]
        },
        "moonlight": {
            "name": "Moonlight",
            "command": ["flatpak", "run", "com.moonlight_stream.Moonlight", "stream", settings.get("moonlight_host")]
        }
    }

    if app_id not in APPS_CONFIG:
        raise HTTPException(status_code=404, detail="Приложение не найдено")
    
    if app_id in active_processes and active_processes[app_id].poll() is None:
        return {"status": "success", "message": f"{APPS_CONFIG[app_id]['name']} уже работает."}

    config = APPS_CONFIG[app_id]
    
    try:
        logger.info(f"Launching {config['name']} with command: {' '.join(config['command'])}")
        
        process = subprocess.Popen(
            config['command'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        active_processes[app_id] = process
        
        return {"status": "success", "message": f"{config['name']} запущено"}
    except FileNotFoundError:
        logger.warning(f"Executable not found for {config['name']}. Emulating launch.")
        return {"status": "success", "warning": f"Command not found (emulation): {' '.join(config['command'])}"}
    except Exception as e:
        logger.error(f"Error launching {app_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/kill/{app_id}")
async def kill_app(app_id: str):
    if app_id not in ["youtube", "website", "moonlight"]:
        raise HTTPException(status_code=404, detail="Приложение не найдено")
        
    process = active_processes.get(app_id)
    if not process or process.poll() is not None:
        return {"status": "success", "message": "Процесс не найден или уже закрыт."}
        
    try:
        process.terminate()
        for _ in range(5):
            if process.poll() is not None:
                break
            await asyncio.sleep(0.5)
            
        if process.poll() is None:
            process.kill()
            
        del active_processes[app_id]
        return {"status": "success", "message": "Приложение закрыто."}
    except Exception as e:
        logger.error(f"Error killing {app_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    logger.warning("Frontend directory not found.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)