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

// Low latency fire and forget
function sendInput(key) {
    fetch('/api/remote/input', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ key }) }).catch(e=>console.error(e));
}

function sendVolume(action) {
    fetch('/api/remote/volume', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ action }) }).catch(e=>console.error(e));
}

// Progressive Hold Logic
let holdInterval = null;
let holdTimeout = null;
function startHold(actionFn, arg) {
    vibrate();
    actionFn(arg);
    holdTimeout = setTimeout(() => {
        holdInterval = setInterval(() => {
            vibrate();
            actionFn(arg);
        }, 60); // Low latency spam rate (down from 150)
    }, 300); // Trigger slightly faster
}

function stopHold() {
    clearTimeout(holdTimeout);
    clearInterval(holdInterval);
}

document.addEventListener("DOMContentLoaded", () => {
    
    // LIVE TEXT INPUT (DELTA SYNC)
    let oldText = "";
    const liveInput = document.getElementById('live-text');
    if (liveInput) {
        liveInput.addEventListener('input', () => {
            const newText = liveInput.value;
            let i = 0;
            while(i < oldText.length && i < newText.length && oldText[i] === newText[i]) i++;
            const deleted = oldText.length - i;
            const added = newText.slice(i);
            
            if (deleted > 0) {
                // Send backspaces
                for(let k=0; k<deleted; k++) sendInput('BackSpace');
            }
            if (added.length > 0) {
                fetch('/api/remote/type', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ text: added }) });
            }
            oldText = newText;
        });
        
        liveInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Stop mobile keyboard default
                sendInput('Return');
                liveInput.value = "";
                oldText = "";
            }
        });
        
        // Ensure weird keyboard behavior doesn't mismatch our cache
        liveInput.addEventListener('blur', () => {
            liveInput.value = "";
            oldText = "";
        });
    }


    const repeatKeys = ['Up', 'Down', 'Left', 'Right'];
    document.querySelectorAll('[data-key]').forEach(btn => {
        const key = btn.getAttribute('data-key');
        const isRepeat = repeatKeys.includes(key);
        
        const press = (e) => {
            if(e.cancelable) e.preventDefault();
            if (isRepeat) startHold(sendInput, key);
            else { vibrate(); sendInput(key); }
        };
        
        btn.addEventListener('touchstart', press, {passive: false});
        btn.addEventListener('mousedown', (e) => { if (e.button === 0) press(e); });
        if (isRepeat) ['touchend', 'mouseup', 'mouseleave', 'touchcancel'].forEach(evt => btn.addEventListener(evt, stopHold));
    });

    const repeatVols = ['up', 'down'];
    document.querySelectorAll('[data-vol]').forEach(btn => {
        const action = btn.getAttribute('data-vol');
        const isRepeat = repeatVols.includes(action);
        
        const press = (e) => {
            if(e.cancelable) e.preventDefault();
            if (isRepeat) startHold(sendVolume, action);
            else { vibrate(); sendVolume(action); }
        };
        
        btn.addEventListener('touchstart', press, {passive: false});
        btn.addEventListener('mousedown', (e) => { if (e.button === 0) press(e); });
        if (isRepeat) ['touchend', 'mouseup', 'mouseleave', 'touchcancel'].forEach(evt => btn.addEventListener(evt, stopHold));
    });

    // BATCHED TRACKPAD (FIXED LAG)
    const tp = document.getElementById('trackpad');
    if (tp) {
        let lastX = 0, lastY = 0;
        let pendingDx = 0, pendingDy = 0;
        let isSendingMouse = false;
        
        tp.addEventListener('touchstart', e => {
            lastX = e.touches[0].clientX;
            lastY = e.touches[0].clientY;
        }, {passive: true});
        
        tp.addEventListener('touchmove', e => {
            if(e.cancelable) e.preventDefault();
            const touch = e.touches[0];
            pendingDx += (touch.clientX - lastX) * 1.5; 
            pendingDy += (touch.clientY - lastY) * 1.5;
            lastX = touch.clientX;
            lastY = touch.clientY;
            
            if(!isSendingMouse) sendAccumulatedMouse();
        }, {passive: false});

        tp.addEventListener('click', () => {
            vibrate();
            fetch('/api/remote/mouse', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ click: "left" }) });
        });
        
        function sendAccumulatedMouse() {
            if (pendingDx === 0 && Math.abs(pendingDy) < 1) return; // allow minor fuzzing ignorance
            isSendingMouse = true;
            
            const toSendX = pendingDx; const toSendY = pendingDy;
            pendingDx = 0; pendingDy = 0;
            
            fetch('/api/remote/mouse', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ dx: toSendX, dy: toSendY })
            }).catch(e=>console.error(e));
            
            // ~30 FPS throttle
            setTimeout(() => {
                isSendingMouse = false;
                if (pendingDx !== 0 || pendingDy !== 0) sendAccumulatedMouse();
            }, 30);
        }
    }

    loadAudioOutputs();
});

// Bluetooth
function toggleBluetooth() {
    vibrate();
    const layer = document.getElementById('bt-layer');
    if (layer.style.display === 'flex') {
        layer.style.display = 'none';
    } else {
        layer.style.display = 'flex';
        loadBluetoothDevices();
    }
}

async function loadBluetoothDevices() {
    const list = document.getElementById('bt-devices-list');
    list.innerHTML = `<div class="text-center text-slate-500 mt-5"><i class="fa-solid fa-circle-notch fa-spin text-2xl"></i><br/>Scanning...</div>`;
    
    try {
        const res = await fetch('/api/bluetooth');
        const data = await res.json();
        
        if (data.status !== 'success' || !data.devices || data.devices.length === 0) {
            list.innerHTML = `<div class="text-center text-slate-500 mt-5">No devices found</div>`;
            return;
        }
        
        list.innerHTML = '';
        data.devices.forEach(d => {
            const btnColor = d.connected ? 'bg-red-500/20 text-red-500' : 'bg-blue-600 hover:bg-blue-500 text-white';
            const btnText = d.connected ? 'Disconnect' : 'Connect';
            const action = d.connected ? `disconnectBT('${d.mac}')` : `connectBT('${d.mac}')`;
            const icon = d.connected ? `<i class="fa-brands fa-bluetooth text-blue-400 mr-2"></i>` : `<i class="fa-solid fa-headphones text-slate-500 mr-2"></i>`;
            
            list.innerHTML += `
                <div class="flex items-center justify-between bg-[#1e293b] p-3 rounded-xl border border-slate-700">
                    <div class="flex-1 overflow-hidden">
                        <div class="font-bold text-sm truncate text-white">${icon} ${d.name}</div>
                        <div class="text-xs text-slate-400 font-mono">${d.mac}</div>
                    </div>
                    <button onclick="${action}" class="px-3 py-2 ${btnColor} rounded-lg text-xs font-semibold ml-3 shadow-md focus:outline-none focus:ring transition">
                        ${btnText}
                    </button>
                </div>
            `;
        });
    } catch(e) {
         list.innerHTML = `<div class="text-center text-red-500 mt-5 bg-red-900/20 p-3 rounded-xl">${e.message || "Failed to load"}</div>`;
    }
}

async function connectBT(mac) {
    vibrate();
    loadBluetoothDevices(); // Show loading again...
    
    // Quick custom toast for BT
    const list = document.getElementById('bt-devices-list');
    list.innerHTML = `<div class="text-center text-slate-500 mt-5"><i class="fa-solid fa-circle-notch fa-spin text-2xl"></i><br/>Connecting to ${mac}...</div>`;
    
    await fetch('/api/bluetooth/connect', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ mac }) });
    setTimeout(loadBluetoothDevices, 1500); // reload to see state
}

async function disconnectBT(mac) {
    vibrate();
    await fetch('/api/bluetooth/disconnect', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ mac }) });
    setTimeout(loadBluetoothDevices, 1000);
}


async function killActive() {
    vibrate();
    if(confirm('Are you sure you want to close the active application?')) {
        fetch('/api/remote/kill_active', { method: 'POST' });
    }
}
function goHome() { vibrate(); fetch('/api/remote/home', { method: 'POST' }); }

let currentLinks = [];
function toggleSettings() {
    vibrate();
    const layer = document.getElementById('settings-layer');
    if (layer.style.display === 'flex') {
        layer.style.display = 'none';
        document.getElementById('file-wallpaper').value = ""; 
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
                    <div class="font-bold text-sm truncate text-white">${link.name}</div>
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
    
    if(!name || !url) { alert("Please set a name and URL!"); return; }
    if(!url.startsWith('http')) url = 'https://' + url;
    
    const id = 'link_' + Date.now();
    currentLinks.push({ id, name, url });
    nameNode.value = ''; urlNode.value = '';
    renderLinks();
}

async function saveSettings(event) {
    vibrate();
    const btn = event.target;
    btn.textContent = 'Saving...';
    
    let wallpaperUrl = document.getElementById('input-wallpaper').value;
    const fileInput = document.getElementById('file-wallpaper');

    if (fileInput.files.length > 0) {
        btn.textContent = 'Uploading file...';
        try {
            const file = fileInput.files[0];
            const ext = file.name.split('.').pop() || 'tmp';
            const buffer = await file.arrayBuffer();
            const upRes = await fetch('/api/upload_wallpaper', {
                method: 'POST',
                headers: {'X-File-Ext': ext},
                body: buffer
            });
            const upData = await upRes.json();
            if (upData.url) wallpaperUrl = upData.url;
        } catch (e) {
            alert('File upload error!');
        }
    }
    
    await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            wallpaper_url: wallpaperUrl,
            moonlight_host: document.getElementById('input-host').value,
            custom_links: currentLinks
        })
    });
    btn.textContent = 'Save Settings';
    toggleSettings();
}

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
