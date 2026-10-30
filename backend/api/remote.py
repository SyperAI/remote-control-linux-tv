import os
import subprocess
import logging
from fastapi import APIRouter
from pydantic import BaseModel
from .core import kill_app, active_processes

logger = logging.getLogger(__name__)
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


def run_xdotool(args):
    """Helper to run xdotool with explicit DISPLAY and error logging"""
    env = os.environ.copy()
    env["DISPLAY"] = env.get("DISPLAY", ":0").strip("'\"")
        
    try:
        res = subprocess.run(["xdotool"] + args, env=env, capture_output=True, text=True)
        if res.returncode != 0:
            logger.error(f"xdotool error (code {res.returncode}): {res.stderr.strip()}")
        return res
    except Exception as e:
        logger.error(f"xdotool execution failed: {e}")
        raise e

def run_pactl(args):
    """Helper to run pactl with proper PulseAudio systemd env variables"""
    env = os.environ.copy()
    
    # Strip any accidental quotes from naive bash exports
    env["XDG_RUNTIME_DIR"] = env.get("XDG_RUNTIME_DIR", "/run/user/1000").strip("'\"")
    env["PULSE_SERVER"] = env.get("PULSE_SERVER", f"unix:{env['XDG_RUNTIME_DIR']}/pulse/native").strip("'\"")
    
    return subprocess.run(["pactl"] + args, env=env, capture_output=True, text=True)

def get_default_sink():
    try:
        res = run_pactl(["get-default-sink"])
        if res.returncode == 0 and res.stdout.strip():
            return res.stdout.strip()
        res_info = run_pactl(["info"])
        for line in res_info.stdout.splitlines():
            if line.startswith("Default Sink:"):
                return line.replace("Default Sink:", "").strip()
    except Exception as e:
        logger.error(f"Error getting default sink: {e}")
    return ""

def unload_combine_sink():
    """Unload all instances of module-combine-sink by their module ID or name"""
    try:
        res = run_pactl(["list", "modules", "short"])
        if res.returncode == 0:
            for line in res.stdout.splitlines():
                parts = line.strip().split()
                if len(parts) >= 2 and parts[1] == "module-combine-sink":
                    run_pactl(["unload-module", parts[0]])
        run_pactl(["unload-module", "module-combine-sink"])
    except Exception as e:
        logger.error(f"Error unloading module-combine-sink: {e}")

def get_bluetooth_sinks():
    """Returns a list of sink names for connected Bluetooth audio devices."""
    res = run_pactl(["list", "sinks"])
    if res.returncode != 0:
        return []
    
    sinks = []
    current_sink = {"name": "", "is_bluetooth": False, "description": ""}
    for line in res.stdout.splitlines():
        line = line.strip()
        if line.startswith("Sink #"):
            if current_sink.get("name"):
                sinks.append(current_sink)
            current_sink = {"name": "", "is_bluetooth": False, "description": ""}
        elif line.startswith("Name:"):
            name = line.replace("Name:", "").strip()
            current_sink["name"] = name
            if "bluez" in name.lower():
                current_sink["is_bluetooth"] = True
        elif line.startswith("Description:"):
            current_sink["description"] = line.replace("Description:", "").strip()
        elif any(k in line for k in ['device.bus = "bluetooth"', 'device.api = "bluez5"', 'api.bluez5', 'bluetooth']):
            current_sink["is_bluetooth"] = True
            
    if current_sink.get("name"):
        sinks.append(current_sink)
        
    bt_sinks = [
        s["name"] for s in sinks 
        if s["is_bluetooth"] and s["name"] != "combined_audio"
    ]
    return bt_sinks

def move_all_sink_inputs_to(target_sink):
    """Move currently playing audio streams to the target sink so audio switches immediately"""
    try:
        res = run_pactl(["list", "sink-inputs", "short"])
        if res.returncode == 0:
            for line in res.stdout.splitlines():
                parts = line.strip().split()
                if parts:
                    input_id = parts[0]
                    run_pactl(["move-sink-input", input_id, target_sink])
    except Exception as e:
        logger.error(f"Error moving sink inputs: {e}")

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
        env = os.environ.copy()
        env["DISPLAY"] = env.get("DISPLAY", ":0").strip("'\"")
        cmd = "xdotool windowminimize $(xdotool getactivewindow) || xdotool key alt+Tab"
        subprocess.run(cmd, env=env, shell=True)
        return {"status": "success", "message": "Going home"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/input")
async def remote_input(key_data: KeyModel):
    try:
        run_xdotool(["key", key_data.key])
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/type")
async def remote_type(data: TextModel):
    try:
        run_xdotool(["type", "--delay", "5", data.text])
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/mouse")
async def remote_mouse(mouse_data: MouseModel):
    try:
        if mouse_data.click:
            run_xdotool(["click", "1"])
        else:
            if mouse_data.dx != 0 or mouse_data.dy != 0:
                run_xdotool(["mousemove_relative", "--", str(int(mouse_data.dx)), str(int(mouse_data.dy))])
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/volume")
async def control_volume(vol_data: VolumeModel):
    try:
        if vol_data.action == "up":
            run_pactl(["set-sink-volume", "@DEFAULT_SINK@", "+5%"])
        elif vol_data.action == "down":
            run_pactl(["set-sink-volume", "@DEFAULT_SINK@", "-5%"])
        elif vol_data.action == "mute":
            run_pactl(["set-sink-mute", "@DEFAULT_SINK@", "toggle"])
        else:
            return {"status": "error", "message": "Unknown action"}
            
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/audio_outputs")
async def get_audio_outputs():
    try:
        result = run_pactl(["list", "sinks"])
        sinks = []
        
        sinks.append({"id": "special_combine_audio", "name": "🎧 Play on ALL Bluetooth Headphones"})
        
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
        
        default_sink = get_default_sink()
        active_id = "special_combine_audio" if default_sink == "combined_audio" else default_sink
        
        if len(sinks) > 1:
            return {"status": "success", "outputs": sinks, "current": active_id}
        return {"status": "success", "outputs": [{"id": "fallback", "name": "No devices found"}], "current": ""}
    except Exception as e:
        logger.error(f"Error listing audio sinks: {e}")
        return {"status": "success", "outputs": [{"id": "dummy1", "name": "TV AudioOut (HDMI)"}], "current": ""}

@router.post("/audio_outputs")
async def set_audio_output(sink_data: AudioSinkModel):
    try:
        unload_combine_sink()
        
        if sink_data.sink_name == "special_combine_audio":
            bt_sinks = get_bluetooth_sinks()
            if not bt_sinks:
                return {
                    "status": "error",
                    "message": "Bluetooth-наушники не найдены. Подключите Bluetooth-устройства перед включением этого режима."
                }
            
            slaves_arg = f"slaves={','.join(bt_sinks)}"
            logger.info(f"Loading module-combine-sink with {slaves_arg}")
            res = run_pactl([
                "load-module", "module-combine-sink",
                "sink_name=combined_audio",
                slaves_arg,
                "sink_properties=device.description=Combined_Bluetooth_Headphones"
            ])
            if res.returncode != 0:
                logger.error(f"Failed to load module-combine-sink: {res.stderr}")
                return {
                    "status": "error",
                    "message": f"Не удалось объединить выходы: {res.stderr.strip()}"
                }
                
            run_pactl(["set-default-sink", "combined_audio"])
            move_all_sink_inputs_to("combined_audio")
            return {
                "status": "success",
                "message": f"Звук выводится только на Bluetooth ({len(bt_sinks)} устр.)"
            }
        else:
            run_pactl(["set-default-sink", sink_data.sink_name])
            move_all_sink_inputs_to(sink_data.sink_name)
            return {"status": "success", "message": "Audio output changed"}
    except Exception as e:
        logger.error(f"Error setting audio output: {e}")
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
