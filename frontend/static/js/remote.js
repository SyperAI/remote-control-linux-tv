function vibrate() { if (navigator.vibrate) navigator.vibrate(20); }

// Mode Switching
function setMode(mode) {
    vibrate();
    if(mode === 'dpad') {
        document.getElementById('area-dpad').classList.remove('section-hidden');
        document.getElementById('area-mouse').classList.add('section-hidden');
        document.getElementById('btn-mode-dpad').classList.add('bg-[#334155]', 'text-white');
        document.getElementById('btn-mode-dpad').classList.remove('text-slate-400');
        document.getElementById('btn-mode-mouse').classList.remove('bg-[#334155]', 'text-white');
        document.getElementById('btn-mode-mouse').classList.add('text-slate-400');
    } else {
        document.getElementById('area-dpad').classList.add('section-hidden');
        document.getElementById('area-mouse').classList.remove('section-hidden');
        document.getElementById('btn-mode-mouse').classList.add('bg-[#334155]', 'text-white');
        document.getElementById('btn-mode-mouse').classList.remove('text-slate-400');
        document.getElementById('btn-mode-dpad').classList.remove('bg-[#334155]', 'text-white');
        document.getElementById('btn-mode-dpad').classList.add('text-slate-400');
    }
}

// Action sending logic
async function sendInput(key) {
    try {
        await fetch('/api/remote/input', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ key })
        });
    } catch(e) {}
}

async function sendVolume(action) {
    try {
        await fetch('/api/remote/volume', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action })
        });
    } catch(e) {}
}

// Progressive Hold Logic
let holdInterval = null;
let holdTimeout = null;

function startHold(actionFn, arg) {
    vibrate();
    actionFn(arg); // Initial press
    holdTimeout = setTimeout(() => {
        holdInterval = setInterval(() => {
            vibrate();
            actionFn(arg);
        }, 150);
    }, 450);
}

function stopHold() {
    clearTimeout(holdTimeout);
    clearInterval(holdInterval);
}

document.addEventListener("DOMContentLoaded", () => {
    // 1. Setup D-Pad buttons
    const repeatKeys = ['Up', 'Down', 'Left', 'Right'];
    document.querySelectorAll('[data-key]').forEach(btn => {
        const key = btn.getAttribute('data-key');
        const isRepeat = repeatKeys.includes(key);
        
        const press = (e) => {
            if(e.cancelable) e.preventDefault();
            if (isRepeat) {
                startHold(sendInput, key);
            } else {
                vibrate();
                sendInput(key);
            }
        };
        
        btn.addEventListener('touchstart', press, {passive: false});
        btn.addEventListener('mousedown', (e) => { if (e.button === 0) press(e); });
        
        if (isRepeat) {
            ['touchend', 'mouseup', 'mouseleave', 'touchcancel'].forEach(evt => {
                btn.addEventListener(evt, stopHold);
            });
        }
    });

    // 2. Setup Volume buttons
    const repeatVols = ['up', 'down'];
    document.querySelectorAll('[data-vol]').forEach(btn => {
        const action = btn.getAttribute('data-vol');
        const isRepeat = repeatVols.includes(action);
        
        const press = (e) => {
            if(e.cancelable) e.preventDefault();
            if (isRepeat) {
                startHold(sendVolume, action);
            } else {
                vibrate();
                sendVolume(action);
            }
        };
        
        btn.addEventListener('touchstart', press, {passive: false});
        btn.addEventListener('mousedown', (e) => { if (e.button === 0) press(e); });
        
        if (isRepeat) {
            ['touchend', 'mouseup', 'mouseleave', 'touchcancel'].forEach(evt => {
                btn.addEventListener(evt, stopHold);
            });
        }
    });

    // 3. Setup Trackpad
    const tp = document.getElementById('trackpad');
    if (tp) {
        let lastX = 0, lastY = 0;
        
        tp.addEventListener('touchstart', e => {
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
        });
        
        tp.addEventListener('touchmove', e => {
            e.preventDefault();
            const touch = e.touches[0];
            const dx = (touch.clientX - lastX) * 1.5; 
            const dy = (touch.clientY - lastY) * 1.5;
            lastX = touch.clientX;
            lastY = touch.clientY;
            
            fetch('/api/remote/mouse', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ dx, dy })
            });
        }, {passive: false});

        tp.addEventListener('click', () => {
            vibrate();
            fetch('/api/remote/mouse', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ click: "left" })
            });
        });
    }

    // 4. Load initial audio config
    loadAudioOutputs();
});

// System Actions
async function killActive() {
    vibrate();
    if(confirm('Точно закрыть запущенное приложение?')) {
        fetch('/api/remote/kill_active', { method: 'POST' });
    }
}
function goHome() { vibrate(); fetch('/api/remote/home', { method: 'POST' }); }

// Settings Logic
let currentLinks = [];

function toggleSettings() {
    vibrate();
    const layer = document.getElementById('settings-layer');
    if (layer.style.display === 'flex') {
        layer.style.display = 'none';
    } else {
        layer.style.display = 'flex';
        fetchRemoteSettings();
    }
}

async function fetchRemoteSettings() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        document.getElementById('input-wallpaper').value = data.wallpaper_url || '';
        document.getElementById('input-host').value = data.moonlight_host || '';
        currentLinks = data.custom_links || [];
        renderLinks();
    } catch (e) {}
}

function renderLinks() {
    const c = document.getElementById('custom-links-container');
    c.innerHTML = '';
    currentLinks.forEach(link => {
        c.innerHTML += `
            <div class="flex items-center justify-between bg-[#1e293b] p-3 rounded-xl border border-slate-700">
                <div class="flex-1 overflow-hidden">
                    <div class="font-bold text-sm truncate">${link.name}</div>
                    <div class="text-xs text-slate-400 truncate">${link.url}</div>
                </div>
                <button onclick="removeLink('${link.id}')" class="text-red-400 p-2 ml-2"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });
}

function removeLink(id) {
    currentLinks = currentLinks.filter(l => l.id !== id);
    renderLinks();
}

function addLink() {
    const nameNode = document.getElementById('new-link-name');
    const urlNode = document.getElementById('new-link-url');
    const name = nameNode.value.trim();
    let url = urlNode.value.trim();
    
    if(!name || !url) { alert("Заполните название и URL!"); return; }
    if(!url.startsWith('http')) url = 'https://' + url;
    
    const id = 'link_' + Date.now();
    currentLinks.push({ id, name, url });
    
    nameNode.value = '';
    urlNode.value = '';
    renderLinks();
}

async function saveSettings(event) {
    vibrate();
    const btn = event.target;
    btn.textContent = 'Сохранение...';
    
    await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            wallpaper_url: document.getElementById('input-wallpaper').value,
            moonlight_host: document.getElementById('input-host').value,
            custom_links: currentLinks
        })
    });
    btn.textContent = 'Сохранить настройки';
    toggleSettings();
}

// Audio Selection
async function loadAudioOutputs() {
    try {
        const res = await fetch('/api/remote/audio_outputs');
        const data = await res.json();
        const select = document.getElementById('audio-outputs');
        select.innerHTML = '';
        
        data.outputs.forEach(device => {
            const opt = document.createElement('option');
            opt.value = device.id;
            opt.textContent = device.name;
            select.appendChild(opt);
        });
    } catch(e) {}
}

async function setAudioOutput(sink_name) {
    vibrate();
    fetch('/api/remote/audio_outputs', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ sink_name }) });
}
