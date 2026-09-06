import subprocess
from fastapi import APIRouter
from pydantic import BaseModel
from .core import kill_app, active_processes

router = APIRouter()

class KeyModel(BaseModel):
    key: str

class TextModel(BaseModel):
    text: str

class AudioSinkModel(BaseModel):
    sink_name: str

class VolumeModel(BaseModel):
    action: str

class MouseModel(BaseModel):
    dx: float = 0
    dy: float = 0
    click: str = ""

class BluetoothMacModel(BaseModel):
    mac: str


@router.post("/kill_active")
async def kill_active():
    killed_any = False
    for app_id in list(active_processes.keys()):
        await kill_app(app_id)
        killed_any = True
    if killed_any:
        return {"status": "success", "message": "All active applications closed"}
    return {"status": "success", "message": "No active applications"}

@router.post("/home")
async def go_home():
    try:
        cmd = "xdotool windowminimize $(xdotool getactivewindow) || xdotool key alt+Tab"
        subprocess.run(cmd, shell=True)
        return {"status": "success", "message": "Going home"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/input")
async def remote_input(key_data: KeyModel):
    try:
        subprocess.run(["xdotool", "key", key_data.key])
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/type")
async def remote_type(data: TextModel):
    try:
        subprocess.run(["xdotool", "type", "--delay", "5", data.text])
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
            return {"status": "error", "message": "Unknown action"}
            
        subprocess.run(cmd)
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/audio_outputs")
async def get_audio_outputs():
    try:
        result = subprocess.run(["pactl", "list", "sinks"], capture_output=True, text=True)
        sinks = []
        
        sinks.append({"id": "special_combine_audio", "name": "🎧 Play on ALL Headphones (Combine)"})
        
        current_name = None
        for line in result.stdout.split("\n"):
            line = line.strip()
            if line.startswith("Name:"):
                current_name = line.replace("Name:", "").strip()
            elif line.startswith("Description:") and current_name:
                desc = line.replace("Description:", "").strip()
                if current_name != "combined_audio":
                    sinks.append({"id": current_name, "name": desc})
                current_name = None
        
        if len(sinks) > 1:
            return {"status": "success", "outputs": sinks}
        return {"status": "success", "outputs": [{"id": "fallback", "name": "No devices found"}]}
    except Exception:
        return {"status": "success", "outputs": [{"id": "dummy1", "name": "TV AudioOut (HDMI)"}]}

@router.post("/audio_outputs")
async def set_audio_output(sink_data: AudioSinkModel):
    try:
        subprocess.run(["pactl", "unload-module", "module-combine-sink"])
        
        if sink_data.sink_name == "special_combine_audio":
            subprocess.run([
                "pactl", "load-module", "module-combine-sink",
                "sink_name=combined_audio",
                "sink_properties=device.description=Combined_All_Headphones"
            ])
            subprocess.run(["pactl", "set-default-sink", "combined_audio"])
        else:
            subprocess.run(["pactl", "set-default-sink", sink_data.sink_name])
            
        return {"status": "success", "message": "Audio output changed"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/bluetooth")
async def list_bluetooth():
    try:
        res = subprocess.run(["bluetoothctl", "devices"], capture_output=True, text=True)
        
        devices = []
        for line in res.stdout.split('\n'):
            if line.startswith("Device"):
                parts = line.split(" ", 2)
                if len(parts) == 3:
                    mac, name = parts[1], parts[2].strip()
                    info = subprocess.run(["bluetoothctl", "info", mac], capture_output=True, text=True)
                    connected = "Connected: yes" in info.stdout
                    devices.append({"mac": mac, "name": name, "connected": connected})
        
        return {"status": "success", "devices": devices}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/bluetooth/connect")
async def bt_connect(data: BluetoothMacModel):
    try:
        subprocess.run(["bluetoothctl", "connect", data.mac])
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/bluetooth/disconnect")
async def bt_disconnect(data: BluetoothMacModel):
    try:
        subprocess.run(["bluetoothctl", "disconnect", data.mac])
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}