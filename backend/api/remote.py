import subprocess
from fastapi import APIRouter
from pydantic import BaseModel
from .core import kill_app, active_processes

router = APIRouter()

class KeyModel(BaseModel):
    key: str

class AudioSinkModel(BaseModel):
    sink_name: str

class VolumeModel(BaseModel):
    action: str

class MouseModel(BaseModel):
    dx: float = 0
    dy: float = 0
    click: str = ""

@router.post("/kill_active")
async def kill_active():
    killed_any = False
    for app_id in list(active_processes.keys()):
        await kill_app(app_id)
        killed_any = True
    if killed_any:
        return {"status": "success", "message": "Все активные приложения закрыты"}
    return {"status": "success", "message": "Нет активных приложений"}

@router.post("/home")
async def go_home():
    try:
        subprocess.run(["xdotool", "windowminimize", "$(xdotool getactivewindow)"], shell=True)
        return {"status": "success", "message": "Переход домой"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/input")
async def remote_input(key_data: KeyModel):
    try:
        subprocess.run(["xdotool", "key", key_data.key])
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/mouse")
async def remote_mouse(mouse_data: MouseModel):
    try:
        if mouse_data.click:
            subprocess.run(["xdotool", "click", "1"])
        else:
            if mouse_data.dx != 0 or mouse_data.dy != 0:
                subprocess.run(["xdotool", "mousemove_relative", "--", str(int(mouse_data.dx)), str(int(mouse_data.dy))])
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/volume")
async def control_volume(vol_data: VolumeModel):
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

@router.get("/audio_outputs")
async def get_audio_outputs():
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
        return {"status": "success", "outputs": [{"id": "fallback", "name": "Устройства не найдены"}]}
    except Exception:
        return {"status": "success", "outputs": [{"id": "dummy1", "name": "TV AudioOut (HDMI)"}]}

@router.post("/audio_outputs")
async def set_audio_output(sink_data: AudioSinkModel):
    try:
        subprocess.run(["pactl", "set-default-sink", sink_data.sink_name])
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
