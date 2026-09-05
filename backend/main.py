import os
import json
import subprocess
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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

class KeyModel(BaseModel):
    key: str

class AudioSinkModel(BaseModel):
    sink_name: str

class VolumeModel(BaseModel):
    action: str  # "up", "down", "mute"

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
    
    # Chromium gives much better control over process isolation (--user-data-dir)
    # ensuring it doesn't merge tabs with an already running instance.
    APPS_CONFIG = {
        "youtube": {
            "name": "YouTube",
            "command": ["chromium-browser", "--user-data-dir=/tmp/tv_youtube", "--no-first-run", "--kiosk", "https://www.youtube.com/tv"]
        },
        "website": {
            "name": "Браузер",
            "command": ["chromium-browser", "--user-data-dir=/tmp/tv_website", "--no-first-run", "--kiosk", settings.get("website_url")]
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

# ==========================================
# REMOTE CONTROL API
# ==========================================

@app.post("/api/remote/kill_active")
async def kill_active():
    """Закрывает все запущенные нами приложения."""
    killed_any = False
    for app_id in list(active_processes.keys()):
        await kill_app(app_id)
        killed_any = True
    if killed_any:
        return {"status": "success", "message": "Все активные приложения закрыты"}
    return {"status": "success", "message": "Нет активных приложений"}

@app.post("/api/remote/home")
async def go_home():
    """Переходит в меню (сворачивает приложения на Linux)."""
    try:
        subprocess.run(["xdotool", "windowminimize", "$(xdotool getactivewindow)"], shell=True)
        return {"status": "success", "message": "Переход домой"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/remote/input")
async def remote_input(key_data: KeyModel):
    """Отправляет нажатия клавиш с пульта D-Pad."""
    try:
        subprocess.run(["xdotool", "key", key_data.key])
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": "Требуется пакет xdotool: " + str(e)}

@app.post("/api/remote/volume")
async def control_volume(vol_data: VolumeModel):
    """Управление громкостью через PulseAudio/PipeWire"""
    try:
        if vol_data.action == "up":
            cmd = ["pactl", "set-sink-volume", "@DEFAULT_SINK@", "+5%"]
        elif vol_data.action == "down":
            cmd = ["pactl", "set-sink-volume", "@DEFAULT_SINK@", "-5%"]
        elif vol_data.action == "mute":
            cmd = ["pactl", "set-sink-mute", "@DEFAULT_SINK@", "toggle"]
        else:
            return {"status": "error", "message": "Неизвестное действие"}
            
        subprocess.run(cmd, check=False)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/remote/audio_outputs")
async def get_audio_outputs():
    """Получает красивый список аудио-устройств (с Linux pc)."""
    try:
        result = subprocess.run(["pactl", "list", "sinks"], capture_output=True, text=True)
        sinks = []
        current_name = None
        for line in result.stdout.split("\n"):
            line = line.strip()
            if line.startswith("Name:"):
                current_name = line.replace("Name:", "").strip()
            elif line.startswith("Description:") and current_name:
                desc = line.replace("Description:", "").strip()
                sinks.append({"id": current_name, "name": desc})
                current_name = None
        
        if sinks:
            return {"status": "success", "outputs": sinks}
        else:
            return {"status": "success", "outputs": [{"id": "fallback", "name": "Устройства не найдены"}]}
    except Exception:
        # Эмуляция для Windows / если нет pactl
        return {"status": "success", "outputs": [{"id": "dummy1", "name": "TV AudioOut (HDMI)"}, {"id": "dummy2", "name": "Режим эмуляции"}]}

@app.post("/api/remote/audio_outputs")
async def set_audio_output(sink_data: AudioSinkModel):
    """Устанавливает выбранное аудио-устройство."""
    try:
        subprocess.run(["pactl", "set-default-sink", sink_data.sink_name])
        return {"status": "success", "message": "Аудио-выход изменён"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# Serve remote interface
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
@app.get("/remote")
async def remote_ui():
    return FileResponse(os.path.join(frontend_dir, "remote.html"))

# Подключаем статику
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
else:
    logger.warning("Frontend directory not found.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)