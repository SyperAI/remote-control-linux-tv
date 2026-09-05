// Clock
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

// Settings Logic
async function fetchSettings() {
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        document.getElementById('input-website').value = data.website_url || '';
        document.getElementById('input-host').value = data.moonlight_host || '';
        
        if (data.website_url) document.getElementById('label-website').textContent = data.website_url;
        if (data.moonlight_host) document.getElementById('label-host').textContent = `ПК: ${data.moonlight_host}`;
    } catch (err) {
        console.error("Failed to fetch settings", err);
    }
}

async function saveSettings() {
    const website_url = document.getElementById('input-website').value;
    const moonlight_host = document.getElementById('input-host').value;
    
    try {
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ website_url, moonlight_host })
        });
        showToast("Настройки успешно сохранены");
        closeSettings();
        fetchSettings();
    } catch (err) {
        showToast("Ошибка сохранения!");
    }
}

function openSettings() {
    document.getElementById('settings-modal').classList.add('active');
}

function closeSettings() {
    document.getElementById('settings-modal').classList.remove('active');
}

// App Launch
async function launchApp(appId) {
    showToast(`Запуск ${appId}...`);
    try {
        const response = await fetch(`/api/launch/${appId}`, { method: 'POST' });
        const data = await response.json();
        
        if (data.warning) {
            showToast(data.warning);
        } else if (data.status === 'success') {
            showToast(data.message || `Запущено`);
        } else {
            showToast(`Ошибка: ${data.detail}`);
        }
    } catch (err) {
        showToast(`Сбой сети или бэкенд не отвечает.`);
    }
}

// Basic D-Pad Navigation
document.addEventListener("DOMContentLoaded", () => {
    const navItems = document.querySelectorAll('.nav-item');
    let currentIndex = 1;

    function updateFocus() {
        if(document.getElementById('settings-modal').classList.contains('active')) return;
        
        navItems.forEach((btn, i) => {
            if (i === currentIndex) {
                btn.classList.add('focused');
                btn.focus();
            } else {
                btn.classList.remove('focused');
            }
        });
    }

    window.addEventListener('keydown', (e) => {
        const isSettingsOpen = document.getElementById('settings-modal').classList.contains('active');
        
        // Toggle settings with 'S' key 
        if (e.key.toLowerCase() === 's') {
            if (isSettingsOpen) closeSettings();
            else openSettings();
            return;
        }

        if (isSettingsOpen) {
            // Allow Exit via Escape or Return (if they want to just close, though we have Save btn)
            if (e.key === 'Escape') closeSettings();
            return; // Отключить навигацию по меню при открытых настройках
        }

        if (e.key === 'ArrowRight') {
            currentIndex = (currentIndex + 1) % navItems.length;
            updateFocus();
        } else if (e.key === 'ArrowLeft') {
            currentIndex = (currentIndex - 1 + navItems.length) % navItems.length;
            updateFocus();
        } else if (e.key === 'Enter') {
            navItems[currentIndex].click();
        }
    });

    fetchSettings();
    updateFocus();
});