# Linux Smart TV Dashboard

A lightweight, modern web-based dashboard designed to turn any Linux desktop/HTPC into a Smart TV. It provides a beautiful interface to launch your favorite apps directly on the host machine, and includes a **Mobile Remote Control** to navigate, control volume, and manage apps from your smartphone.

## Features

- **Moonlight Game Streaming**: Seamlessly launch Moonlight (via Flatpak) to stream games from your main PC.
- **YouTube TV**: Launches a kiosk-mode Firefox browser aimed at the leanback YouTube TV interface.
- **Custom Web Apps**: Configure a custom URL (e.g., your favorite streaming service) right from the dashboard settings.
- **Mobile Remote**: Access `/remote` via your smartphone's browser to get a D-Pad, Volume controls, Audio-output switcher, and "Home/Kill" buttons.
- **FastAPI Backend**: A lightweight Python backend that handles local configuration and application process management.

## Architecture

1. **Frontend**: HTML / Tailwind CSS / Vanilla JS. Serves as the TV Dashboard and Mobile Remote.
2. **Backend**: Python / FastAPI. Interacts with the Linux OS to execute/kill processes, swap volume, and emulate keystrokes.

## Prerequisites

- Python 3.10+
- `uv` (Fast Python package installer and resolver)
- `firefox` (for web apps)
- `flatpak` and `com.moonlight_stream.Moonlight` (for game streaming)
- `xdotool` (Required for D-Pad cursor navigation and minimizing windows on X11)
- `pulseaudio` or `pipewire-pulse` (Requires `pactl` command for volume/audio routing)

## Installation & Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/SyperAI/remote-control-linux-tv.git
   cd remote-control
   ```

2. Install dependencies using `uv`:
   ```bash
   uv sync
   ```

3. Start the application:
   ```bash
   uv run backend/main.py
   ```

4. **TV Screen:** Open your browser in kiosk mode pointing to `http://localhost:8000`.
5. **Mobile Remote:** Open your smartphone browser to `http://<YOUR_LINUX_IP>:8000/remote`.

## Configuration

Settings can be changed dynamically by clicking the **Gear Icon** in the top right corner of the TV dashboard.
You can specify:
- Your internal PC's IP address (for Moonlight/Sunshine pairing).
- The arbitrary website URL to launch in the custom app slot.
