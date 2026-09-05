function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false });
    let dateStr = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('date').textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
}
setInterval(updateClock, 1000); 
updateClock();

function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').textContent = msg;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

let currentIndex = 0;
let lastConfigRaw = "";

async function fetchConfig() {
    try {
        const res = await fetch('/api/settings');
        const text = await res.text();
        
        if (text === lastConfigRaw) return;
        lastConfigRaw = text;
        const data = JSON.parse(text);
        
        const grid = document.getElementById('apps-grid');
        grid.innerHTML = '';
        
        // 1. YouTube
        grid.innerHTML += `
            <button onclick="launchApp('youtube')" class="nav-item app-card glass-panel glow-youtube h-64 p-8 flex flex-col justify-between text-left group">
                <div class="w-16 h-16 rounded-2xl bg-red-500/20 text-red-500 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform"><i class="fa-brands fa-youtube"></i></div>
                <div><h3 class="text-2xl font-bold mb-2">YouTube</h3><p class="text-gray-400 text-sm">Видео, ТВ и трансляции</p></div>
            </button>`;

        // 2. Moonlight
        grid.innerHTML += `
            <button onclick="launchApp('moonlight')" class="nav-item app-card glass-panel glow-moonlight h-64 p-8 flex flex-col justify-between text-left group">
                <div class="w-16 h-16 rounded-2xl bg-green-500/20 text-green-400 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform"><i class="fa-solid fa-desktop"></i></div>
                <div><h3 class="text-2xl font-bold mb-2">Moonlight</h3><p class="text-gray-400 text-sm">ПК: ${data.moonlight_host}</p></div>
            </button>`;

        // 3. Custom Browser Links
        if (data.custom_links && data.custom_links.length > 0) {
            data.custom_links.forEach(link => {
                grid.innerHTML += `
                    <button onclick="launchApp('${link.id}')" class="nav-item app-card glass-panel glow-web h-64 p-8 flex flex-col justify-between text-left group">
                        <div class="w-16 h-16 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform"><i class="fa-solid fa-globe"></i></div>
                        <div>
                            <h3 class="text-2xl font-bold mb-2 truncate" title="${link.name}">${link.name}</h3>
                            <p class="text-gray-400 text-sm overflow-hidden text-ellipsis whitespace-nowrap" title="${link.url}">${link.url.replace(/^https?:\/\//, '')}</p>
                        </div>
                    </button>`;
            });
        }
        
        updateFocus();
    } catch (err) { }
}

async function launchApp(appId) {
    showToast(`Запуск...`);
    try {
        const response = await fetch(`/api/launch/${appId}`, { method: 'POST' });
        const data = await response.json();
        
        if (data.warning) showToast(data.warning);
        else if (data.status === 'success') showToast(data.message || `Запущено`);
        else showToast(`Ошибка: ${data.detail}`);
    } catch (err) {
        showToast(`Сбой сети или бэкенд не отвечает.`);
    }
}

function updateFocus() {
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems.length === 0) return;
    
    if (currentIndex >= navItems.length) currentIndex = 0;
    
    navItems.forEach((btn, i) => {
        if (i === currentIndex) {
            btn.classList.add('focused');
            btn.focus();
        } else {
            btn.classList.remove('focused');
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    window.addEventListener('keydown', (e) => {
        const navItems = document.querySelectorAll('.nav-item');
        if (navItems.length === 0) return;

        if (e.key === 'ArrowRight') {
            currentIndex = (currentIndex + 1) % navItems.length;
            updateFocus();
        } else if (e.key === 'ArrowLeft') {
            currentIndex = (currentIndex - 1 + navItems.length) % navItems.length;
            updateFocus();
        } else if (e.key === 'Enter') {
            if (navItems[currentIndex]) {
                navItems[currentIndex].click();
            }
        }
    });

    fetchConfig();
    setInterval(fetchConfig, 3000);
});