function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    let dateStr = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('date').textContent = dateStr;
}
setInterval(updateClock, 1000); 
updateClock();

async function initBattery() {
    if ('getBattery' in navigator) {
        try {
            const battery = await navigator.getBattery();
            updateBatteryUI(battery);
            
            battery.addEventListener('levelchange', () => updateBatteryUI(battery));
            battery.addEventListener('chargingchange', () => updateBatteryUI(battery));
        } catch (e) {
            console.error('Battery API error', e);
        }
    }
}

function updateBatteryUI(battery) {
    const container = document.getElementById('battery-status');
    const icon = document.getElementById('battery-icon');
    const levelText = document.getElementById('battery-level');
    
    if(!container) return;
    container.classList.remove('hidden');
    
    const level = Math.round(battery.level * 100);
    levelText.textContent = `${level}%`;
    
    icon.className = 'fa-solid text-xl drop-shadow-md ';
    
    if (battery.charging) {
        icon.classList.add('fa-plug', 'text-green-400');
        return;
    }
    
    if (level > 80) icon.classList.add('fa-battery-full', 'text-white');
    else if (level > 60) icon.classList.add('fa-battery-three-quarters', 'text-white');
    else if (level > 40) icon.classList.add('fa-battery-half', 'text-white');
    else if (level > 15) icon.classList.add('fa-battery-quarter', 'text-yellow-400');
    else icon.classList.add('fa-battery-empty', 'text-red-500', 'animate-pulse');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

let currentIndex = 0;
let lastConfigRaw = "";
let currentWallpaperUrl = "";

function applyWallpaper(url) {
    if (url === currentWallpaperUrl) return;
    currentWallpaperUrl = url;
    
    const bgBox = document.getElementById('dynamic-bg');
    if (!url) {
        bgBox.innerHTML = '';
        bgBox.style.background = 'radial-gradient(circle at center, #1a1b26 0%, #0d0d14 100%)';
        return;
    }
    
    if (url.match(/\.(mp4|webm|mov|ogg)$/i)) {
        bgBox.innerHTML = `<video autoplay loop muted playsinline style="width:100%; height:100%; object-fit:cover; position:absolute; top:0; left:0;"><source src="${url}"></video>`;
        bgBox.style.background = 'transparent';
    } else {
        bgBox.innerHTML = '';
        bgBox.style.background = `url('${url}') center/cover no-repeat`;
    }
}

async function fetchConfig() {
    try {
        const res = await fetch('/api/tv_state');
        const text = await res.text();
        
        if (text === lastConfigRaw) return;
        lastConfigRaw = text;
        const data = JSON.parse(text);
        
        applyWallpaper(data.wallpaper_url);
        
        const profileNameEl = document.getElementById('profile-name');
        if (profileNameEl) profileNameEl.textContent = data.profile_name || 'Guest';
        
        const grid = document.getElementById('apps-grid');
        grid.innerHTML = '';
        
        // 1. YouTube
        if (data.show_youtube !== false) {
            grid.innerHTML += `
                <button onclick="launchApp('youtube')" class="nav-item app-card glass-panel glow-youtube h-64 p-8 flex flex-col justify-between text-left group">
                    <div class="w-16 h-16 rounded-[1.2rem] bg-red-500/20 text-red-100 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(239,68,68,0.3)]"><i class="fa-brands fa-youtube drop-shadow-md"></i></div>
                    <div><h3 class="text-3xl font-bold mb-2 tracking-tight">YouTube</h3><p class="text-white/60 text-sm font-medium">Videos, TV & streams</p></div>
                </button>`;
        }

        // 2. Moonlight
        if (data.show_moonlight !== false) {
            grid.innerHTML += `
                <button onclick="launchApp('moonlight')" class="nav-item app-card glass-panel glow-moonlight h-64 p-8 flex flex-col justify-between text-left group">
                    <div class="w-16 h-16 rounded-[1.2rem] bg-green-500/20 text-green-100 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(34,197,94,0.3)]"><i class="fa-solid fa-desktop drop-shadow-md"></i></div>
                    <div><h3 class="text-3xl font-bold mb-2 tracking-tight">Moonlight</h3><p class="text-white/60 text-sm font-medium">PC: ${data.moonlight_host}</p></div>
                </button>`;
        }

        // 3. Custom Browser Links
        if (data.custom_links && data.custom_links.length > 0) {
            data.custom_links.forEach(link => {
                grid.innerHTML += `
                    <button onclick="launchApp('${link.id}')" class="nav-item app-card glass-panel glow-web h-64 p-8 flex flex-col justify-between text-left group">
                        <div class="w-16 h-16 rounded-[1.2rem] bg-purple-500/20 text-purple-100 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(168,85,247,0.3)]"><i class="fa-solid fa-globe drop-shadow-md"></i></div>
                        <div>
                            <h3 class="text-3xl font-bold mb-3 truncate tracking-tight" title="${link.name}">${link.name}</h3>
                            <div class="inline-block px-3 py-1 bg-white/10 rounded-lg text-white/70 text-xs font-semibold overflow-hidden text-ellipsis whitespace-nowrap max-w-full" title="${link.url}">${link.url.replace(/^https?:\/\//, '')}</div>
                        </div>
                    </button>`;
            });
        }
        
        // 4. Custom OS Apps
        if (data.custom_apps && data.custom_apps.length > 0) {
            data.custom_apps.forEach(app => {
                const iconClass = app.icon || 'fa-solid fa-rocket';
                grid.innerHTML += `
                    <button onclick="launchApp('${app.id}')" class="nav-item app-card glass-panel glow-web h-64 p-8 flex flex-col justify-between text-left group">
                        <div class="w-16 h-16 rounded-[1.2rem] bg-orange-500/20 text-orange-200 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(249,115,22,0.3)]"><i class="${iconClass} drop-shadow-md"></i></div>
                        <div>
                            <h3 class="text-3xl font-bold mb-3 truncate tracking-tight" title="${app.name}">${app.name}</h3>
                            <div class="inline-block px-3 py-1 bg-white/10 rounded-lg text-white/70 text-xs font-semibold overflow-hidden text-ellipsis whitespace-nowrap max-w-full font-mono" title="${app.command}">${app.command}</div>
                        </div>
                    </button>`;
            });
        }
        
        updateFocus();
    } catch (err) { }
}

async function launchApp(appId) {
    showToast(`Launching...`);
    try {
        const response = await fetch(`/api/launch/${appId}`, { method: 'POST' });
        const data = await response.json();
        
        if (data.warning) showToast(data.warning);
        else if (data.status === 'success') showToast(data.message || `Launched`);
        else showToast(`Error: ${data.detail}`);
    } catch (err) {
        showToast(`Network failure or backend unresponsive.`);
    }
}

function updateFocus() {
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems.length === 0) return;
    
    if (currentIndex >= navItems.length) currentIndex = navItems.length - 1;
    if (currentIndex < 0) currentIndex = 0;
    
    navItems.forEach((btn, i) => {
        if (i === currentIndex) {
            btn.classList.add('focused');
            btn.focus();
        } else {
            btn.classList.remove('focused');
        }
    });
}

// GAMEPAD API LOGIC
let gamepadState = {}; 

function pollGamepads() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    
    for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp) continue;

        if (!gamepadState[i]) gamepadState[i] = { buttons: {}, axes: {} };
        const state = gamepadState[i];

        const checkButton = (btnIdx, action) => {
            if (gp.buttons[btnIdx] && gp.buttons[btnIdx].pressed) {
                if (!state.buttons[btnIdx]) {
                    state.buttons[btnIdx] = true;
                    action();
                }
            } else {
                state.buttons[btnIdx] = false;
            }
        };

        const navItems = document.querySelectorAll('.nav-item');
        if (navItems.length === 0) continue;
        const cols = 3;

        // D-Pad
        checkButton(14, () => { if (currentIndex > 0) { currentIndex--; updateFocus(); } }); // Left
        checkButton(15, () => { if (currentIndex < navItems.length - 1) { currentIndex++; updateFocus(); } }); // Right
        checkButton(12, () => { if (currentIndex - cols >= 0) { currentIndex -= cols; updateFocus(); } }); // Up
        checkButton(13, () => { 
            if (currentIndex + cols < navItems.length) { currentIndex += cols; } 
            else { currentIndex = navItems.length - 1; }
            updateFocus(); 
        }); // Down

        // A Button (Select) (usually btn 0 on Xbox mapping)
        checkButton(0, () => { 
            if (navItems[currentIndex]) {
                navItems[currentIndex].classList.add("scale-95", "opacity-80", "transition");
                setTimeout(() => navItems[currentIndex].classList.remove("scale-95", "opacity-80"), 150);
                navItems[currentIndex].click(); 
            }
        });

        // Left Analog Stick
        const axisThresholdOuter = 0.6;
        const axisThresholdInner = 0.3; // Used to reset holding state
        
        const axX = gp.axes[0];
        const axY = gp.axes[1];
        
        // Horizontal Support
        if (axX < -axisThresholdOuter) {
            if (!state.axes.left) { state.axes.left = true; if (currentIndex > 0) { currentIndex--; updateFocus(); } }
        } else if (axX > -axisThresholdInner) { state.axes.left = false; }
        
        if (axX > axisThresholdOuter) {
            if (!state.axes.right) { state.axes.right = true; if (currentIndex < navItems.length - 1) { currentIndex++; updateFocus(); } }
        } else if (axX < axisThresholdInner) { state.axes.right = false; }

        // Vertical Support
        if (axY < -axisThresholdOuter) {
            if (!state.axes.up) { state.axes.up = true; if (currentIndex - cols >= 0) { currentIndex -= cols; updateFocus(); } }
        } else if (axY > -axisThresholdInner) { state.axes.up = false; }
        
        if (axY > axisThresholdOuter) {
            if (!state.axes.down) { 
                state.axes.down = true; 
                if (currentIndex + cols < navItems.length) { currentIndex += cols; } 
                else { currentIndex = navItems.length - 1; }
                updateFocus();
            }
        } else if (axY < axisThresholdInner) { state.axes.down = false; }
    }
    
    requestAnimationFrame(pollGamepads);
}

document.addEventListener("DOMContentLoaded", () => {
    initBattery();
    
    window.addEventListener('keydown', (e) => {
        const navItems = document.querySelectorAll('.nav-item');
        if (navItems.length === 0) return;

        const cols = 3;

        if (e.key === 'ArrowRight') {
            if (currentIndex < navItems.length - 1) currentIndex++;
        } else if (e.key === 'ArrowLeft') {
            if (currentIndex > 0) currentIndex--;
        } else if (e.key === 'ArrowDown') {
            if (currentIndex + cols < navItems.length) {
                currentIndex += cols;
            } else {
                currentIndex = navItems.length - 1;
            }
        } else if (e.key === 'ArrowUp') {
            if (currentIndex - cols >= 0) {
                currentIndex -= cols;
            }
        } else if (e.key === 'Enter') {
            if (navItems[currentIndex]) {
                navItems[currentIndex].click();
            }
        }
        
        updateFocus();
    });

    fetchConfig();
    setInterval(fetchConfig, 3000);
    
    // Start Gamepad tracking
    window.addEventListener("gamepadconnected", (e) => {
        console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
            e.gamepad.index, e.gamepad.id,
            e.gamepad.buttons.length, e.gamepad.axes.length);
    });
    requestAnimationFrame(pollGamepads);
});

