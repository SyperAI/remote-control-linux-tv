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

let holdInterval = null;
let holdTimeout = null;
function startHold(actionFn, arg) {
    vibrate();
    actionFn(arg);
    holdTimeout = setTimeout(() => {
        holdInterval = setInterval(() => {
            vibrate();
            actionFn(arg);
        }, 60); 
    }, 300); 
}

function stopHold() {
    clearTimeout(holdTimeout);
    clearInterval(holdInterval);
}

document.addEventListener("DOMContentLoaded", () => {
    
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
                for(let k=0; k<deleted; k++) sendInput('BackSpace');
            }
            if (added.length > 0) {
                fetch('/api/remote/type', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ text: added }) });
            }
            oldText = newText;
        });
        
        liveInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); 
                sendInput('Return');
                liveInput.value = "";
                oldText = "";
            }
        });
        
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
            if (pendingDx === 0 && Math.abs(pendingDy) < 1) return;
            isSendingMouse = true;
            
            const toSendX = pendingDx; const toSendY = pendingDy;
            pendingDx = 0; pendingDy = 0;
            
            fetch('/api/remote/mouse', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ dx: toSendX, dy: toSendY })
            }).catch(e=>console.error(e));
            
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
        const res = await fetch('/api/remote/bluetooth');
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
    loadBluetoothDevices();
    const list = document.getElementById('bt-devices-list');
    list.innerHTML = `<div class="text-center text-slate-500 mt-5"><i class="fa-solid fa-circle-notch fa-spin text-2xl"></i><br/>Connecting to ${mac}...</div>`;
    
    await fetch('/api/remote/bluetooth/connect', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ mac }) });
    setTimeout(loadBluetoothDevices, 1500); 
}

async function disconnectBT(mac) {
    vibrate();
    await fetch('/api/remote/bluetooth/disconnect', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ mac }) });
    setTimeout(loadBluetoothDevices, 1000);
}

async function killActive() {
    vibrate();
    if(confirm('Are you sure you want to close the active application?')) {
        fetch('/api/remote/kill_active', { method: 'POST' });
    }
}
function goHome() { vibrate(); fetch('/api/remote/home', { method: 'POST' }); }


// PROFILES & SETTINGS LOGIC
let fullSettings = null;
let editingProfileId = null;

function toggleSettings() {
    vibrate();
    const layer = document.getElementById('settings-layer');
    if (layer.style.display === 'flex') {
        layer.style.display = 'none';
        document.getElementById('file-default-wallpaper').value = "";
        document.getElementById('file-prof-wallpaper').value = "";
    } else {
        layer.style.display = 'flex';
        fetchRemoteSettings();
    }
}

async function fetchRemoteSettings() {
    try {
        const res = await fetch('/api/settings');
        fullSettings = await res.json();
        
        if (!fullSettings.profiles) fullSettings.profiles = [];
        
        document.getElementById('input-default-wallpaper').value = fullSettings.default_wallpaper || '';
        document.getElementById('input-host').value = fullSettings.moonlight_host || '';
        
        populateProfileDropdown();
        
        if (fullSettings.profiles.length > 0) {
            const active = fullSettings.profiles.find(p => p.id === fullSettings.active_profile_id);
            editingProfileId = active ? active.id : fullSettings.profiles[0].id;
        } else {
            editingProfileId = null;
        }
        
        renderEditingProfile();
    } catch (e) {
        console.error("Failed to load settings");
    }
}

function populateProfileDropdown() {
    const sel = document.getElementById('profile-selector');
    sel.innerHTML = '';
    
    if (!fullSettings.profiles || fullSettings.profiles.length === 0) {
        const opt = document.createElement('option');
        opt.textContent = "No Profiles Available";
        sel.appendChild(opt);
        return;
    }
    
    fullSettings.profiles.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        let prefix = (p.id === fullSettings.active_profile_id) ? "📺 [ACTIVE] " : "";
        if (p.password === '***LOCKED***' || p.is_locked) prefix += "🔒 ";
        
        opt.textContent = prefix + p.name;
        sel.appendChild(opt);
    });
}

function renderEditingProfile() {
    if (!editingProfileId) return;
    
    document.getElementById('profile-selector').value = editingProfileId;
    const prof = fullSettings.profiles.find(p => p.id === editingProfileId);
    if (!prof) return;
    
    if (prof.password === '***LOCKED***' || prof.is_locked) {
        document.getElementById('locked-overlay').style.display = 'block';
        document.getElementById('profile-edit-fields').style.display = 'none';
        return;
    } else {
        document.getElementById('locked-overlay').style.display = 'none';
        document.getElementById('profile-edit-fields').style.display = 'block';
    }
    
    document.getElementById('prof-name').value = prof.name || '';
    document.getElementById('prof-password').value = prof.password || '';
    document.getElementById('prof-wallpaper').value = prof.wallpaper_url || '';
    
    document.getElementById('prof-show-yt').checked = (prof.show_youtube !== false);
    document.getElementById('prof-show-ml').checked = (prof.show_moonlight !== false);
    
    renderLinks(prof.custom_links || []);
}

async function unlockEditingProfile() {
    vibrate();
    const prof = fullSettings.profiles.find(p => p.id === editingProfileId);
    if (!prof) return;
    
    const pwd = prompt(`Enter password to unlock profile "${prof.name}":`);
    if (pwd === null) return;
    
    try {
        const res = await fetch('/api/profile/unlock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile_id: prof.id, password: pwd })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            const idx = fullSettings.profiles.findIndex(p => p.id === prof.id);
            if (idx !== -1) {
                fullSettings.profiles[idx] = data.profile;
            }
            populateProfileDropdown(); // updates icon
            renderEditingProfile();
        } else {
            alert('Incorrect password!');
        }
    } catch(e) {
        alert("Server error");
    }
}

function switchEditingProfile() {
    const sel = document.getElementById('profile-selector');
    if (!sel.value) return;
    
    // Only save if it's currently unlocked
    const oldProf = fullSettings.profiles.find(p => p.id === editingProfileId);
    if (oldProf && oldProf.password !== '***LOCKED***' && !oldProf.is_locked) {
        saveCurrentProfileEditsToMemory(); 
    }
    
    editingProfileId = sel.value;
    renderEditingProfile();
}

function addProfile() {
    const oldProf = fullSettings.profiles.find(p => p.id === editingProfileId);
    if (oldProf && oldProf.password !== '***LOCKED***' && !oldProf.is_locked) {
        saveCurrentProfileEditsToMemory(); 
    }
    
    const id = 'prof_' + Date.now();
    fullSettings.profiles.push({
        id: id,
        name: 'New Profile',
        password: '',
        wallpaper_url: '',
        show_youtube: true,
        show_moonlight: true,
        custom_links: [],
        is_locked: false
    });
    populateProfileDropdown();
    editingProfileId = id;
    renderEditingProfile();
}

function deleteEditingProfile() {
    if(!confirm("Delete this profile?")) return;
    fullSettings.profiles = fullSettings.profiles.filter(p => p.id !== editingProfileId);
    
    if (fullSettings.profiles.length > 0) {
        editingProfileId = fullSettings.profiles[0].id;
    } else {
        editingProfileId = null;
    }
    populateProfileDropdown();
    renderEditingProfile();
}

function renderLinks(links) {
    const c = document.getElementById('custom-links-container');
    c.innerHTML = '';
    
    if (links.length === 0) {
        c.innerHTML = '<div class="text-xs text-slate-500 italic pb-2">No apps added for this profile.</div>';
    }
    
    links.forEach(link => {
        c.innerHTML += `
            <div class="flex items-center justify-between bg-[#0f172a] p-3 rounded-xl border border-slate-700 shadow-inner">
                <div class="flex-1 overflow-hidden">
                    <div class="font-bold text-sm truncate text-white">${link.name}</div>
                    <div class="text-xs text-slate-400 truncate">${link.url}</div>
                </div>
                <button onclick="removeLink('${link.id}')" class="text-red-400 p-2 ml-2 hover:bg-red-500/20 rounded-lg"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });
}

function removeLink(id) {
    const prof = fullSettings.profiles.find(p => p.id === editingProfileId);
    if(prof) {
        prof.custom_links = prof.custom_links.filter(l => l.id !== id);
        renderLinks(prof.custom_links);
    }
}

function addLink() {
    const prof = fullSettings.profiles.find(p => p.id === editingProfileId);
    if (!prof) return;
    
    const nameNode = document.getElementById('new-link-name');
    const urlNode = document.getElementById('new-link-url');
    const name = nameNode.value.trim();
    let url = urlNode.value.trim();
    
    if(!name || !url) { alert("Please set a name and URL!"); return; }
    if(!url.startsWith('http')) url = 'https://' + url;
    
    if (!prof.custom_links) prof.custom_links = [];
    prof.custom_links.push({ id: 'link_' + Date.now(), name, url });
    nameNode.value = ''; urlNode.value = '';
    renderLinks(prof.custom_links);
}

function saveCurrentProfileEditsToMemory() {
    if (!editingProfileId || !fullSettings || !fullSettings.profiles) return;
    const prof = fullSettings.profiles.find(p => p.id === editingProfileId);
    if (prof && prof.password !== '***LOCKED***' && !prof.is_locked) {
        prof.name = document.getElementById('prof-name').value;
        prof.password = document.getElementById('prof-password').value;
        prof.wallpaper_url = document.getElementById('prof-wallpaper').value;
        prof.show_youtube = document.getElementById('prof-show-yt').checked;
        prof.show_moonlight = document.getElementById('prof-show-ml').checked;
    }
}

async function castActiveProfile() {
    vibrate();
    const prof = fullSettings.profiles.find(p => p.id === editingProfileId);
    if (!prof) return;
    
    if (prof.password !== '***LOCKED***' && !prof.is_locked) {
        saveCurrentProfileEditsToMemory(); 
    }
    
    let enteredPassword = "";
    if (prof.is_locked || prof.password) {
        enteredPassword = prompt(`Profile ${prof.name} is password protected.\nEnter PIN/Password to cast to TV:`);
        if (enteredPassword === null) return; 
    }
    
    try {
        const res = await fetch('/api/switch_profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile_id: prof.id, password: enteredPassword })
        });
        const data = await res.json();
        if (data.status === 'success') {
            fullSettings.active_profile_id = prof.id;
            populateProfileDropdown();
            alert(`Success: Switched TV to ${prof.name}!`);
        } else {
            alert(`Error: ${data.message}`);
        }
    } catch(e) {
        alert("Failed to communicate with TV");
    }
}

async function uploadFile(fileInputId) {
    const fileInput = document.getElementById(fileInputId);
    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const ext = file.name.split('.').pop() || 'tmp';
        const buffer = await file.arrayBuffer();
        const res = await fetch('/api/upload_wallpaper', {
            method: 'POST',
            headers: {'X-File-Ext': ext},
            body: buffer
        });
        const data = await res.json();
        return data.url;
    }
    return null;
}

async function saveSettings(event) {
    vibrate();
    const btn = event.target;
    btn.textContent = 'Saving...';
    
    try {
        const prof = fullSettings.profiles.find(p => p.id === editingProfileId);
        if (prof && prof.password !== '***LOCKED***' && !prof.is_locked) {
            saveCurrentProfileEditsToMemory();
        }
        
        try {
            const globalUrl = await uploadFile('file-default-wallpaper');
            if (globalUrl) document.getElementById('input-default-wallpaper').value = globalUrl;
            
            if (prof && prof.password !== '***LOCKED***' && !prof.is_locked) {
                const profUrl = await uploadFile('file-prof-wallpaper');
                if (profUrl) {
                    document.getElementById('prof-wallpaper').value = profUrl;
                    saveCurrentProfileEditsToMemory(); 
                }
            }
        } catch (e) {
            console.error('File upload error', e);
        }
        
        fullSettings.default_wallpaper = document.getElementById('input-default-wallpaper').value;
        fullSettings.moonlight_host = document.getElementById('input-host').value;

        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fullSettings)
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            alert("Error saving settings to backend: " + res.status + " " + errorText);
            btn.textContent = 'Save Changes';
            return;
        }
        
        btn.textContent = 'Save Changes';
        toggleSettings();
    } catch (e) {
        alert("Client error saving settings: " + e.message);
        btn.textContent = 'Save Changes';
    }
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