// Telegram Web App initialization
const tg = window.Telegram.WebApp;

// Expand Web App to full height
tg.expand();
tg.ready();

// Configuration - CHANGE THIS TO YOUR API URL
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5001' 
    : 'https://your-api-domain.com';

// User data from Telegram
const user = tg.initDataUnsafe.user || {};
const userId = user.id;
const username = user.username || 'Гость';
const fullName = user.first_name + (user.last_name ? ' ' + user.last_name : '');

// Get referral code from URL (?ref=CODE)
const urlParams = new URLSearchParams(window.location.search);
const refCode = urlParams.get('ref');

// State
let currentBalance = 0;
let selectedTopupAmount = null;
let currentModel = null;
let swiper = null;
let models = [];  // Loaded from API
let favorites = [];  // Loaded from API

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    tg.setHeaderColor('#1E1E1E');
    tg.setBackgroundColor('#1E1E1E');
    
    document.getElementById('profile-name').textContent = fullName || 'Гость';
    document.getElementById('profile-username').textContent = username ? '@' + username : '';
    
    // Load models from API with optional referral code
    loadModels();
    loadUserData();
    
    tg.BackButton.onClick(() => goBack());
});

// Load models from API
async function loadModels() {
    try {
        let url = `${API_BASE_URL}/api/models`;
        const params = [];
        if (userId) params.push(`user_id=${userId}`);
        if (refCode) params.push(`ref=${refCode}`);
        if (params.length) url += '?' + params.join('&');
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            models = data.models;
            loadCatalog();
            
            const countEl = document.querySelector('.models-count');
            if (countEl) countEl.textContent = `${models.length} моделей`;
        } else {
            showToast('Ошибка загрузки каталога', 'error');
        }
    } catch (error) {
        console.error('Error loading models:', error);
        showToast('Ошибка соединения с сервером', 'error');
    }
}

// Load user data from API
async function loadUserData() {
    if (!userId) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/user/${userId}`);
        const data = await response.json();
        
        if (data.success) {
            currentBalance = data.user.balance || 0;
            favorites = data.user.favorites || [];
            updateStats();
            updateFavoritesCount();
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Load catalog grid
function loadCatalog() {
    const grid = document.getElementById('models-grid');
    if (!grid) return;
    
    if (models.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;"><p>Каталог пуст</p></div>';
        return;
    }
    
    grid.innerHTML = models.map(model => `
        <div class="model-card" onclick="showModelDetail('${model.id}')">
            <div class="model-image">
                ${model.name ? model.name[0] : '?'}
                ${model.health ? `
                    <div class="health-indicator">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        ✓
                    </div>
                ` : ''}
            </div>
            <div class="model-card-info">
                <div class="model-card-name">${model.name || 'Без имени'}</div>
                <div class="model-card-age">${model.age || '?'} года</div>
            </div>
        </div>
    `).join('');
}

// Show model detail
function showModelDetail(modelId) {
    currentModel = models.find(m => String(m.id) === String(modelId));
    if (!currentModel) return;
    
    document.getElementById('detail-name').textContent = currentModel.name || 'Без имени';
    document.getElementById('detail-age').textContent = (currentModel.age || '?') + ' года';
    document.getElementById('detail-services').textContent = currentModel.services || 'Не указано';
    document.getElementById('detail-extras').textContent = currentModel.extras || 'Не указано';
    document.getElementById('detail-height').textContent = currentModel.height || '-';
    document.getElementById('detail-weight').textContent = currentModel.weight || '-';
    document.getElementById('detail-bust').textContent = currentModel.bust || '-';
    document.getElementById('detail-about').textContent = currentModel.about || 'Нет описания';
    document.getElementById('price-1h').textContent = currentModel.price1h || '-';
    document.getElementById('price-2h').textContent = currentModel.price2h || '-';
    document.getElementById('price-night').textContent = currentModel.priceNight || '-';
    
    const healthBadge = document.getElementById('detail-health');
    if (healthBadge) {
        healthBadge.style.display = currentModel.health ? 'flex' : 'none';
    }
    
    const swiperWrapper = document.getElementById('swiper-wrapper');
    if (swiperWrapper) {
        swiperWrapper.innerHTML = '';
        const photoCount = currentModel.photos || 3;
        for (let i = 0; i < photoCount; i++) {
            swiperWrapper.innerHTML += `<div class="swiper-slide">${currentModel.name ? currentModel.name[0] : '?'}</div>`;
        }
    }
    
    if (swiper) swiper.destroy(true, true);
    swiper = new Swiper('.swiper-container', {
        slidesPerView: 1,
        spaceBetween: 0,
        pagination: { el: '.swiper-pagination', clickable: true },
        loop: (currentModel.photos || 3) > 1,
    });
    
    const heartBtn = document.querySelector('.favorite-heart');
    if (heartBtn) {
        heartBtn.classList.toggle('active', favorites.includes(currentModel.id));
    }
    
    navigateTo('detail');
    tg.BackButton.show();
}

// Toggle favorite for current model
async function toggleFavoriteCurrent() {
    if (!currentModel || !userId) {
        showToast('Войдите через Telegram для избранного', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/user/${userId}/favorites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model_id: currentModel.id })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const heartBtn = document.querySelector('.favorite-heart');
            heartBtn.classList.toggle('active', data.is_favorite);
            
            if (data.is_favorite) {
                favorites.push(currentModel.id);
            } else {
                favorites = favorites.filter(id => id !== currentModel.id);
            }
            
            updateFavoritesCount();
            updateStats();
            showToast(data.is_favorite ? 'Добавлено в избранное' : 'Удалено из избранного', data.is_favorite ? 'success' : 'error');
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        showToast('Ошибка', 'error');
    }
}

// Update favorites count
function updateFavoritesCount() {
    const countEl = document.querySelector('.favorites-count');
    if (countEl) {
        countEl.textContent = favorites.length;
        countEl.style.display = favorites.length > 0 ? 'flex' : 'none';
    }
}

// Update stats
function updateStats() {
    const balanceEl = document.getElementById('stat-balance');
    const ordersEl = document.getElementById('stat-orders');
    const favEl = document.getElementById('stat-favorites');
    const topupBalanceEl = document.getElementById('topup-balance');
    
    if (balanceEl) balanceEl.textContent = currentBalance.toLocaleString() + ' ₽';
    if (ordersEl) ordersEl.textContent = '0';
    if (favEl) favEl.textContent = favorites.length;
    if (topupBalanceEl) topupBalanceEl.textContent = currentBalance.toLocaleString() + ' ₽';
}

// Navigation history
let navHistory = ['catalog'];

// Navigate to screen
function navigateTo(screenName) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    
    const targetScreen = document.getElementById(`screen-${screenName}`);
    if (targetScreen) targetScreen.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    const navItem = document.querySelector(`.nav-item[data-screen="${screenName}"]`);
    if (navItem) navItem.classList.add('active');
    
    if (navHistory[navHistory.length - 1] !== screenName) {
        navHistory.push(screenName);
    }
    
    if (screenName === 'catalog') tg.BackButton.hide();
    else tg.BackButton.show();
    
    if (screenName === 'favorites') loadFavorites();
    if (screenName === 'profile') {
        updateStats();
        loadUserData();
    }
}

// Go back
function goBack() {
    if (navHistory.length > 1) {
        navHistory.pop();
        navigateTo(navHistory[navHistory.length - 1]);
    } else {
        navigateTo('catalog');
    }
}

// Load favorites
function loadFavorites() {
    const grid = document.getElementById('favorites-grid');
    const emptyState = document.getElementById('empty-favorites');
    
    if (!grid || !emptyState) return;
    
    const favoriteModels = models.filter(m => favorites.includes(m.id));
    
    if (favoriteModels.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    grid.innerHTML = favoriteModels.map(model => `
        <div class="model-card" onclick="showModelDetail('${model.id}')">
            <div class="model-image">
                ${model.name ? model.name[0] : '?'}
                ${model.health ? `
                    <div class="health-indicator">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        ✓
                    </div>
                ` : ''}
            </div>
            <div class="model-card-info">
                <div class="model-card-name">${model.name || 'Без имени'}</div>
                <div class="model-card-age">${model.age || '?'} года</div>
            </div>
        </div>
    `).join('');
}

// Show favorites screen
function showFavorites() {
    navigateTo('favorites');
}

// Select topup amount
function selectAmount(amount) {
    selectedTopupAmount = amount;
    document.querySelectorAll('.amount-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.amount) === amount);
    });
}

// Submit topup
async function submitTopup() {
    if (!userId) {
        showToast('Войдите через Telegram', 'error');
        return;
    }
    
    if (!selectedTopupAmount) {
        showToast('Выберите сумму', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/topup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, amount: selectedTopupAmount })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Запрос на ${selectedTopupAmount.toLocaleString()} ₽ отправлен`, 'success');
            
            tg.sendData(JSON.stringify({ action: 'topup', amount: selectedTopupAmount }));
            
            selectedTopupAmount = null;
            document.querySelectorAll('.amount-btn').forEach(btn => btn.classList.remove('active'));
        } else {
            showToast(data.error || 'Ошибка', 'error');
        }
    } catch (error) {
        console.error('Error submitting topup:', error);
        showToast('Ошибка соединения', 'error');
    }
}

// Order model
async function orderModel() {
    if (!currentModel) return;
    
    if (!userId) {
        showToast('Войдите через Telegram', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                model_id: currentModel.id,
                model_name: currentModel.name
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`Заказ ${currentModel.name} отправлен`, 'success');
            tg.sendData(JSON.stringify({ action: 'order', model_id: currentModel.id, model_name: currentModel.name }));
        } else {
            showToast(data.error || 'Ошибка', 'error');
        }
    } catch (error) {
        console.error('Error creating order:', error);
        showToast('Ошибка соединения', 'error');
    }
}

// Show support
function showSupport() {
    tg.openTelegramLink('https://t.me/SuppAshoo');
}

// Show toast notification
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' 
        ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>'
        : '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    
    toast.innerHTML = `${icon}<span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Handle visibility change
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        loadUserData();
        updateFavoritesCount();
    }
});
