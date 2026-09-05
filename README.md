# Linux Smart TV Dashboard

A lightweight, modern web-based dashboard designed to turn any Linux desktop/HTPC into a Smart TV. It provides a beautiful interface to launch your favorite apps directly on the host machine while laying the foundation for remote control via a smartphone browser.

## Features

- **Moonlight Game Streaming**: Seamlessly launch Moonlight (via Flatpak) to stream games from your main PC.
- **YouTube TV**: Launches a kiosk-mode Firefox browser aimed at the leanback YouTube TV interface.
- **Custom Web Apps**: Configure a custom URL (e.g., your favorite streaming service) right from the dashboard settings.
- **D-Pad Navigation**: Fully supports keyboard arrows (and by extension gamepad D-pads) for Smart TV-style application focusing.
- **FastAPI Backend**: A lightweight Python backend that handles local configuration and application process management (launching & terminating).
- **Glassmorphism UI**: Beautifully crafted with HTML, JS, and Tailwind CSS.

## Architecture

1. **Frontend**: HTML / Tailwind CSS / Vanilla JS. Serves as the TV Dashboard.
2. **Backend**: Python / FastAPI. Interacts with the host Linux OS to execute/kill processes.

## Prerequisites

- Python 3.10+
- `uv` (Fast Python package installer and resolver)
- `firefox` (for web apps)
- `flatpak` and `com.moonlight_stream.Moonlight` (if you plan to use game streaming)

## Installation & Setup

1. Clone the repository:
   ```bash
   git clone [https://github.com/yourusername/remote-control.git](https://github.com/SyperAI/remote-control-linux-tv.git)
   cd remote-control-linux-tv
   ```

2. Install dependencies and set up the virtual environment using `uv`:
   ```bash
   uv sync
   ```

3. Start the application:
   ```bash
   uv run backend/main.py
   ```

4. Open your browser in full screen/kiosk mode pointing to `http://localhost:8000`.

## Configuration

Settings can be changed dynamically by clicking the **Gear Icon** in the top right corner of the TV dashboard.
You can specify:
- Your internal PC's IP address (for Moonlight/Sunshine pairing).
- The arbitrary website URL to launch in the custom app slot.

Settings are saved locally to `settings.json` in the root directory.

## Coming Soon (Part 2)

- **Mobile Remote App**: A secondary web interface accessible via your smartphone to remotely navigate the TV UI, launch apps, and act as a trackpad/controller.
