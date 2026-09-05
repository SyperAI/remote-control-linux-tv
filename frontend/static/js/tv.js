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
    
    // Check if video (basic regex checking common video exts)
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
        const res = await fetch('/api/settings');
        const text = await res.text();
        
        if (text === lastConfigRaw) return;
        lastConfigRaw = text;
        const data = JSON.parse(text);
        
        // Apply wallpaper
        applyWallpaper(data.wallpaper_url);
        
        const grid = document.getElementById('apps-grid');
        grid.innerHTML = '';
        
        // 1. YouTube
        grid.innerHTML += `
            <button onclick="launchApp('youtube')" class="nav-item app-card glass-panel glow-youtube h-64 p-8 flex flex-col justify-between text-left group">
                <div class="w-16 h-16 rounded-[1.2rem] bg-red-500/20 text-red-100 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(239,68,68,0.3)]"><i class="fa-brands fa-youtube drop-shadow-md"></i></div>
                <div><h3 class="text-3xl font-bold mb-2 tracking-tight">YouTube</h3><p class="text-white/60 text-sm font-medium">Видео, ТВ и трансляции</p></div>
            </button>`;

        // 2. Moonlight
        grid.innerHTML += `
            <button onclick="launchApp('moonlight')" class="nav-item app-card glass-panel glow-moonlight h-64 p-8 flex flex-col justify-between text-left group">
                <div class="w-16 h-16 rounded-[1.2rem] bg-green-500/20 text-green-100 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(34,197,94,0.3)]"><i class="fa-solid fa-desktop drop-shadow-md"></i></div>
                <div><h3 class="text-3xl font-bold mb-2 tracking-tight">Moonlight</h3><p class="text-white/60 text-sm font-medium">ПК: ${data.moonlight_host}</p></div>
            </button>`;

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

document.addEventListener("DOMContentLoaded", () => {
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
});