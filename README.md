# Linux Smart TV Dashboard & Remote

A lightweight, modern web-based dashboard designed to turn any Linux desktop/HTPC into a Smart TV. It provides a beautiful, visually appealing interface to launch your favorite apps directly on the host machine, and includes a **Progressive Web App (PWA) Mobile Remote Control** to navigate, type, control volume, manage Bluetooth, and manage user profiles from your smartphone.

> **💡 Fun Fact:** This entire project and its rich feature set were designed, written, and debugged with the assistance of **Antigravity** (an agentic AI system by Google DeepMind).

## Features

- **Progressive Web App (PWA) Remote**: Install the remote directly to your smart phone's home screen for a native app experience.
- **D-Pad & Trackpad Modes**: Navigate the TV menu via D-Pad, or switch to laptop-style Trackpad mode for a virtual mouse and live text typing capabilities.
- **User Profiles & Parental Controls**: Create multiple user profiles, each with its own custom wallpapers, app shortcuts, toggles, and optional password protection.
- **Moonlight Game Streaming**: Seamlessly launch Moonlight (via Flatpak) to stream games from your main PC directly to the TV.
- **YouTube TV & Custom Web Apps**: Launches isolated Kiosk-mode Chromium instances for YouTube TV and unlimited Custom Browser Apps (Netflix, Twitch, etc.).
- **Advanced Audio & Bluetooth**: Scan, connect, and disconnect Bluetooth headphones directly from the remote. Includes a "Play on ALL Headphones" feature that combines audio sinks so multiple people can listen simultaneously.
- **Native Gamepad Support**: Freely navigate the main Smart TV dashboard using a physical Xbox, PlayStation, or generic Bluetooth controller using the browser Gamepad API.

## Architecture

1. **Frontend**: HTML / Tailwind CSS / Vanilla JS. Provides the main Dashboard (`/`) and Mobile Remote (`/remote`).
2. **Backend**: Python / FastAPI. Integrates seamlessly with the Linux OS to execute/kill graphical processes securely, manage DBus sessions, swap volume outputs, handle bluetooth devices, and emulate virtual keystrokes.

## Prerequisites

- **OS**: Linux (Specifically configured for **X11** sessions. Wayland imposes hardware restrictions on virtual inputs like `xdotool`).
- **Python**: 3.10+ and `uv` (Fast Python package installer).
- **Browser**: `chromium` (for launching sandboxed web apps).
- **Streaming**: `flatpak` and `com.moonlight_stream.Moonlight`.
- **System Tools**: 
  - `xdotool` (Required for Trackpad/D-Pad virtual inputs and minimizing windows).
  - `pulseaudio` or `pipewire-pulse` (Requires the `pactl` module for volume and audio routing).
  - `bluetoothctl` (For managing Bluetooth pairings).

## Installation & Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/SyperAI/remote-control-linux-tv.git
   cd remote-control
   ```

2. Install backend dependencies using `uv`:
   ```bash
   uv sync
   ```

3. Start the application:
   ```bash
   uv run backend/main.py
   ```
   *(Note: For full DBUS and Audio routing on autostart, it is highly recommended to run this via a `systemd` `--user` service)*

4. **TV Screen:** Open your browser in fullscreen/kiosk mode pointing to `http://localhost:8000`.
5. **Mobile Remote:** Open your smartphone browser to `http://<YOUR_LINUX_IP>:8000/remote` and press "Add to Home Screen" to install the PWA.

## Configuration

All configuration is managed dynamically and visually through the **Settings & Profiles** menu (the Gear Icon tab) directly on the mobile app. Profile customizations, host IPs, and environment layouts are automatically saved securely in a local `settings.json` file.
