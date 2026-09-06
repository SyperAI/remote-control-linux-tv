import os
import json
import subprocess
import asyncio
import time
from typing import List, Optional
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

class ProfileModel(BaseModel):
    id: str
    name: str
    wallpaper_url: str = ""
    password: str = ""
    show_youtube: bool = True
    show_moonlight: bool = True
    custom_links: List[CustomLink]
    is_locked: Optional[bool] = False

class SettingsModel(BaseModel):
    default_wallpaper: str = ""
    moonlight_host: str = "192.168.1.10"
    active_profile_id: str = "default"
    profiles: List[ProfileModel] = []

class SwitchProfileRequest(BaseModel):
    profile_id: str
    password: str = ""


def get_settings():
    default_data = {
        "default_wallpaper": "",
        "moonlight_host": "192.168.1.10",
        "active_profile_id": "default",
        "profiles": [
            {
                "id": "default",
                "name": "Default Profile",
                "wallpaper_url": "",
                "password": "",
                "show_youtube": True,
                "show_moonlight": True,
                "custom_links": [{"id": "link_google", "name": "Google", "url": "https://google.com"}]
            }
        ]
    }
    
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                
                if "profiles" not in data:
                    data = {
                        "default_wallpaper": data.get("wallpaper_url", ""),
                        "moonlight_host": data.get("moonlight_host", "192.168.1.10"),
                        "active_profile_id": "default",
                        "profiles": [
                            {
                                "id": "default",
                                "name": "Default Profile",
                                "wallpaper_url": "",
                                "password": "",
                                "show_youtube": True,
                                "show_moonlight": True,
                                "custom_links": data.get("custom_links", [])
                            }
                        ]
                    }
                return data
        except Exception as e:
            logger.error(f"Error reading settings: {e}")
            
    return default_data

@router.get("/settings")
def read_settings():
    # Return settings but mask locked profiles
    data = get_settings()
    for p in data.get("profiles", []):
        if p.get("password"):
            p["is_locked"] = True
            p["password"] = "***LOCKED***"
            p["custom_links"] = []
            p["wallpaper_url"] = ""
            p["show_youtube"] = False
            p["show_moonlight"] = False
        else:
            p["is_locked"] = False
    return data

@router.post("/settings")
def write_settings(settings: SettingsModel):
    try:
        frontend_data = json.loads(settings.model_dump_json() if hasattr(settings, 'model_dump_json') else settings.json())
        existing_data = get_settings()
        existing_profiles_map = {p["id"]: p for p in existing_data.get("profiles", [])}
        
        # Merge locked profiles correctly
        for i, p in enumerate(frontend_data.get("profiles", [])):
            if p.get("password") == "***LOCKED***":
                # Restore the hidden sensitive fields from the database
                if p["id"] in existing_profiles_map:
                    real = existing_profiles_map[p["id"]]
                    p["password"] = real.get("password", "")
                    p["custom_links"] = real.get("custom_links", [])
                    p["wallpaper_url"] = real.get("wallpaper_url", "")
                    p["show_youtube"] = real.get("show_youtube", True)
                    p["show_moonlight"] = real.get("show_moonlight", True)
                else:
                    # Should not happen normally, but drop the locked status if no match
                    p["password"] = ""
            
            # Ensure no dummy is_locked gets saved
            if "is_locked" in p:
                del p["is_locked"]
        
        # Ensure active_profile_id exists in the profiles list
        if not any(p["id"] == frontend_data["active_profile_id"] for p in frontend_data.get("profiles", [])):
            if frontend_data.get("profiles"):
                frontend_data["active_profile_id"] = frontend_data["profiles"][0]["id"]
            else:
                frontend_data["active_profile_id"] = ""

        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(frontend_data, f, indent=4, ensure_ascii=False)
            
        return {"status": "success", "message": "Settings saved"}
    except Exception as e:
        logger.error(f"Error saving settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/profile/unlock")
def unlock_profile(req: SwitchProfileRequest):
    settings = get_settings()
    target = next((p for p in settings.get("profiles", []) if p["id"] == req.profile_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    if target.get("password") and target["password"] != req.password:
        return {"status": "error", "message": "Incorrect password"}
        
    target["is_locked"] = False
    return {"status": "success", "profile": target}

@router.get("/tv_state")
def get_tv_state():
    settings = get_settings()
    active_id = settings.get("active_profile_id", "default")
    profiles = settings.get("profiles", [])
    
    active_profile = next((p for p in profiles if p["id"] == active_id), None)
    if not active_profile and len(profiles) > 0:
        active_profile = profiles[0]
    elif not active_profile:
        active_profile = {"name": "No Profile", "custom_links": [], "wallpaper_url": ""}

    wallpaper = active_profile.get("wallpaper_url") or settings.get("default_wallpaper", "")
    
    return {
        "moonlight_host": settings.get("moonlight_host", "192.168.1.10"),
        "wallpaper_url": wallpaper,
        "custom_links": active_profile.get("custom_links", []),
        "profile_name": active_profile.get("name", "Unknown"),
        "show_youtube": active_profile.get("show_youtube", True),
        "show_moonlight": active_profile.get("show_moonlight", True)
    }

@router.post("/switch_profile")
def switch_profile(req: SwitchProfileRequest):
    settings = get_settings()
    target = next((p for p in settings.get("profiles", []) if p["id"] == req.profile_id), None)
    
    if not target:
        return {"status": "error", "message": "Profile not found"}
        
    if target.get("password") and target.get("password") != req.password:
        return {"status": "error", "message": "Incorrect password"}
        
    settings["active_profile_id"] = req.profile_id
    
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=4, ensure_ascii=False)
        return {"status": "success", "message": f"Switched to {target['name']}"}
    except Exception as e:
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
    active_id = settings.get("active_profile_id", "default")
    profiles = settings.get("profiles", [])
    active_profile = next((p for p in profiles if p["id"] == active_id), profiles[0] if profiles else {})

    APPS_CONFIG = {
        "youtube": {
            "name": "YouTube",
            "command": ["chromium", "--user-data-dir=/tmp/tv_youtube", "--no-first-run", "--kiosk", "https://www.youtube.com/tv"]
        },
        "moonlight": {
            "name": "Moonlight",
            # Launch standard GUI. The user can navigate via D-Pad or Mouse.
            # Passing 'stream' argument requires an explicit App Name component which causes it to crash if omitted.
            "command": ["flatpak", "run", "com.moonlight_stream.Moonlight"]
        }
    }
    
    for link in active_profile.get("custom_links", []):
        APPS_CONFIG[link["id"]] = {
            "name": link["name"],
            "command": ["chromium", f"--user-data-dir=/tmp/tv_{link['id']}", "--no-first-run", "--kiosk", link["url"]]
        }

    if app_id not in APPS_CONFIG:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if app_id in active_processes and active_processes[app_id].poll() is None:
        return {"status": "success", "message": f"{APPS_CONFIG[app_id]['name']} is already running."}

    config = APPS_CONFIG[app_id]
    
    # Securely setup DBUS, AUDIO and DISPLAY without inheriting malformed strings from bash scripts
    launch_env = os.environ.copy()
    
    launch_env["DISPLAY"] = launch_env.get("DISPLAY", ":0").strip("'\"")
    launch_env["XDG_RUNTIME_DIR"] = launch_env.get("XDG_RUNTIME_DIR", "/run/user/1000").strip("'\"")
    launch_env["DBUS_SESSION_BUS_ADDRESS"] = launch_env.get("DBUS_SESSION_BUS_ADDRESS", f"unix:path={launch_env['XDG_RUNTIME_DIR']}/bus").strip("'\"")
    launch_env["PULSE_SERVER"] = launch_env.get("PULSE_SERVER", f"unix:{launch_env['XDG_RUNTIME_DIR']}/pulse/native").strip("'\"")
        
    try:
        logger.info(f"Launching {config['name']} with command: {' '.join(config['command'])}")
        
        process = subprocess.Popen(
            config['command'],
            env=launch_env
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