// ========================================
// Telegram Web App Integration
// ========================================
const tg = window.Telegram?.WebApp;
const isTelegramApp = !!tg?.initData;

// ========================================
// Состояние приложения
// ========================================
let transactions = [];
let currentTheme = 'light';
let isDataLoaded = false;
let onboardingComplete = false;
let currentCurrency = { code: 'RUB', symbol: '₽', locale: 'ru-RU' };
let currencyLoaded = false;
let weeklyChart = null; 
let analyticsType = 'expense';

// ========================================
// Элементы DOM
// ========================================
const balanceEl = document.getElementById('balance');
const incomeEl = document.getElementById('income');
const expenseEl = document.getElementById('expense');
const transactionListEl = document.getElementById('transaction-list');
const form = document.getElementById('transaction-form');
const descriptionInput = document.getElementById('description');
const amountInput = document.getElementById('amount');
const dateInput = document.getElementById('transaction-date');
const themeToggle = document.getElementById('theme-toggle');

const splashScreen = document.getElementById('splash-screen');
const greetingScreen = document.getElementById('greeting-screen');
const currencyScreen = document.getElementById('currency-screen');
const mainApp = document.getElementById('main-app');

// ========================================
// Получение уникального ID пользователя
// ========================================
function getUserId() {
    if (isTelegramApp && tg.initDataUnsafe?.user?.id) {
        return tg.initDataUnsafe.user.id.toString();
    }
    let localId = localStorage.getItem('web_user_id');
    if (!localId) {
        localId = 'web_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('web_user_id', localId);
    }
    return localId;
}

// ========================================
// Синхронизация с сервером (ОБЛАКО)
// ========================================
async function loadFromServer() {
    try {
        const userId = getUserId();
        const response = await fetch(`/api/sync?userId=${userId}`);
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.transactions && data.transactions.length > 0) {
                transactions = data.transactions;
            }
            if (data.theme) {
                currentTheme = data.theme;
            }
            if (data.currency) {
                currentCurrency = data.currency;
                currencyLoaded = true;
            }

            localStorage.setItem('transactions', JSON.stringify(transactions));
            localStorage.setItem('theme', currentTheme);
            localStorage.setItem('currency', JSON.stringify(currentCurrency));
            
            return true;
        }
    } catch (e) {
        console.error('Ошибка загрузки из облака:', e);
    }
    return false;
}

async function saveToServer() {
    try {
        const userId = getUserId();
        await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                transactions: transactions,
                theme: currentTheme,
                currency: currentCurrency
            })
        });
    } catch (e) {
        console.error('Ошибка сохранения в облако:', e);
    }
}

// ========================================
// Инициализация (ИСПРАВЛЕНА ФОНОВАЯ ЗАГРУЗКА)
// ========================================
async function init() {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.max = today;

    if (isTelegramApp) {
        tg.ready();
        tg.expand();
        if (tg.colorScheme === 'dark') currentTheme = 'dark';
    } 

    // 1. МОМЕНТАЛЬНО грузим локальный кэш
    const savedTransactions = localStorage.getItem('transactions');
    if (savedTransactions) {
        try { transactions = JSON.parse(savedTransactions); } catch (e) { transactions = []; }
    }
    currentTheme = localStorage.getItem('theme') || currentTheme;
    
    const savedCurrency = localStorage.getItem('currency');
    if (savedCurrency) {
        try { currentCurrency = JSON.parse(savedCurrency); currencyLoaded = true; } catch (e) {}
    }

    applyTheme(currentTheme);
    updateUI();
    updateCurrencySymbol();
    
    isDataLoaded = true;
    
    // 2. СРАЗУ запускаем интерфейс, не дожидаясь интернета!
    startOnboarding();

    // 3. Запускаем фоновую синхронизацию
    loadFromServer().then((success) => {
        if (success) {
            applyTheme(currentTheme);
            updateUI();
            updateCurrencySymbol();
        }
    }).catch(err => console.log('Синхронизация отложена из-за сети'));
}

function saveData() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('theme', currentTheme);
    saveToServer();
}

function saveCurrency() {
    localStorage.setItem('currency', JSON.stringify(currentCurrency));
    saveToServer();
}

// ========================================
// Онбординг
// ========================================
function startOnboarding() {
    if (sessionStorage.getItem('onboardingShown')) {
        skipToApp();
        return;
    }
    setupUserData();
    setTimeout(() => { transitionToGreeting(); }, 1500);
}

function setupUserData() {
    const avatarEl = document.getElementById('user-avatar');
    const greetingTextEl = document.getElementById('greeting-text');

    if (isTelegramApp && tg.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;
        const firstName = user.first_name || 'Друг';
        greetingTextEl.textContent = `Привет, ${firstName}`;
        if (user.photo_url) {
            avatarEl.src = user.photo_url;
            avatarEl.onerror = () => { showAvatarPlaceholder(avatarEl, firstName); };
        } else {
            showAvatarPlaceholder(avatarEl, firstName);
        }
    } else {
        greetingTextEl.textContent = 'Добро пожаловать';
        showAvatarPlaceholder(avatarEl, 'В');
    }
}

function showAvatarPlaceholder(avatarEl, name) {
    const initial = name.charAt(0).toUpperCase();
    const container = avatarEl.parentElement;
    avatarEl.style.display = 'none';
    const placeholder = document.createElement('div');
    placeholder.className = 'avatar-placeholder';
    placeholder.textContent = initial;
    placeholder.style.cssText = `
        width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white; font-size: 3.5rem; font-weight: 600; border-radius: 50%;
    `;
    container.appendChild(placeholder);
}

function transitionToGreeting() {
    const splashContent = splashScreen.querySelector('.splash-content');
    splashContent.classList.add('splash-exit');
    setTimeout(() => {
        splashScreen.classList.add('hidden');
        greetingScreen.classList.remove('hidden');
        setTimeout(() => {
            if (currencyLoaded) {
                const greetingContent = greetingScreen.querySelector('.greeting-content');
                greetingContent.classList.add('greeting-exit');
                setTimeout(() => {
                    greetingScreen.classList.add('hidden');
                    showMainApp();
                }, 500);
            } else {
                transitionToCurrency();
            }
        }, 2000);
    }, 600);
}

function transitionToCurrency() {
    const greetingContent = greetingScreen.querySelector('.greeting-content');
    greetingContent.classList.add('greeting-exit');
    setTimeout(() => {
        greetingScreen.classList.add('hidden');
        currencyScreen.classList.remove('hidden');
        initCurrencySelection();
    }, 500);
}

function initCurrencySelection() {
    document.querySelectorAll('.currency-option').forEach(option => {
        option.addEventListener('click', () => { selectCurrency(option); });
    });
}

function selectCurrency(option) {
    currentCurrency = {
        code: option.dataset.currency,
        symbol: option.dataset.symbol,
        locale: option.dataset.locale
    };
    saveCurrency();
    if (isTelegramApp && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
    transitionToApp();
}

function transitionToApp() {
    const currencyContent = currencyScreen.querySelector('.currency-content');
    if (currencyContent) currencyContent.classList.add('currency-exit');
    setTimeout(() => {
        splashScreen.classList.add('hidden');
        greetingScreen.classList.add('hidden');
        currencyScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        mainApp.classList.add('app-enter');
        sessionStorage.setItem('onboardingShown', 'true');
        onboardingComplete = true;
        updateUI();
        if (isTelegramApp && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
    }, 500);
}

function showMainApp() {
    currencyScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    mainApp.classList.add('app-enter');
    sessionStorage.setItem('onboardingShown', 'true');
    onboardingComplete = true;
    updateUI();
    updateCurrencySymbol();
}

function skipToApp() {
    splashScreen.classList.add('hidden');
    greetingScreen.classList.add('hidden');
    currencyScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    mainApp.style.opacity = '1';
    mainApp.style.transform = 'scale(1)';
    onboardingComplete = true;
}

// ========================================
// Логика работы
// ========================================

function applyTheme(theme) {
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    currentTheme = theme;
    saveData();
    if (weeklyChart) updateWeeklyAnalytics();
}

function toggleTheme() {
    applyTheme(currentTheme === 'light' ? 'dark' : 'light');
}

function updateUI() {
    updateBalance();
    updateTransactionList();
    updateWeeklyAnalytics();
}

function updateBalance() {
    const amounts = transactions.map(t => t.amount);
    const total = amounts.reduce((acc, val) => acc + val, 0);
    const income = amounts.filter(v => v > 0).reduce((acc, val) => acc + val, 0);
    const expense = amounts.filter(v => v < 0).reduce((acc, val) => acc + val, 0);

    balanceEl.textContent = formatCurrency(total);
    incomeEl.textContent = formatCurrency(income);
    expenseEl.textContent = formatCurrency(Math.abs(expense));
}

function updateWeeklyAnalytics() {
    const analyticsSection = document.getElementById('analytics-section');
    const analyticsBars = document.getElementById('analytics-bars');
    const analyticsTip = document.getElementById('analytics-tip');
    const analyticsPeriod = document.getElementById('analytics-period');

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const allWeekTransactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= weekAgo && tDate <= today;
    });

    if (allWeekTransactions.length === 0) {
        analyticsSection.style.display = 'none';
        return;
    }

    analyticsSection.style.display = 'block';
    analyticsPeriod.textContent = `${formatDate(weekAgo)} — ${formatDate(today)}`;

    const filteredTransactions = allWeekTransactions.filter(t => {
        return analyticsType === 'expense' ? t.amount < 0 : t.amount > 0;
    });

    if (filteredTransactions.length === 0) {
        analyticsBars.innerHTML = `<div style="text-align: center; padding: 30px 10px; color: var(--color-muted);">Нет ${analyticsType === 'expense' ? 'расходов' : 'доходов'} за эту неделю</div>`;
        analyticsTip.innerHTML = '';
        if (weeklyChart) {
            weeklyChart.destroy();
            weeklyChart = null;
        }
        return;
    }

    const categories = {};
    filteredTransactions.forEach(t => {
        const cat = t.description || 'Другое';
        categories[cat] = (categories[cat] || 0) + Math.abs(t.amount);
    });

    const sorted = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    const totalAmount = sorted.reduce((sum, [, amount]) => sum + amount, 0);

    const labels = sorted.map(item => item[0]);
    const data = sorted.map(item => item[1]);
    
    const expenseColors = ['#e74c3c', '#e67e22', '#f1c40f', '#3498db', '#9b59b6', '#1abc9c'];
    const incomeColors = ['#2ecc71', '#27ae60', '#1abc9c', '#16a085', '#3498db', '#2980b9'];
    const barColors = analyticsType === 'expense' ? expenseColors : incomeColors;

    analyticsBars.innerHTML = '<canvas id="weeklyChartCanvas"></canvas>';
    const ctx = document.getElementById('weeklyChartCanvas').getContext('2d');

    if (weeklyChart) weeklyChart.destroy();

    weeklyChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: barColors, borderWidth: 0, hoverOffset: 4 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: currentTheme === 'dark' ? '#f5f5f5' : '#333', padding: 20, font: { family: 'Inter', size: 12 } } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) label += ': ';
                            if (context.raw !== null) label += formatCurrency(context.raw);
                            return label;
                        }
                    }
                }
            }
        }
    });

    document.getElementById('weeklyChartCanvas').parentElement.style.height = '250px';

    const topCategory = sorted[0];
    const topPercent = Math.round((topCategory[1] / totalAmount) * 100);

    let tip = '';
    if (analyticsType === 'expense') {
        if (topPercent >= 50) {
            tip = `<span class="analytics-tip-icon">⚠️</span> <strong>${topCategory[0]}</strong> — это ${topPercent}% расходов. Стоит обратить внимание!`;
        } else {
            tip = `<span class="analytics-tip-icon">💡</span> Больше всего потрачено на <strong>${topCategory[0]}</strong> — ${topPercent}%.`;
        }
    } else {
        tip = `<span class="analytics-tip-icon">🎉</span> Главный источник дохода: <strong>${topCategory[0]}</strong> (${topPercent}%).`;
    }
    analyticsTip.innerHTML = tip;
}

function groupTransactionsByDate(transactions) {
    const groups = {};
    transactions.forEach(transaction => {
        const date = transaction.date || new Date().toISOString().split('T')[0];
        if (!groups[date]) groups[date] = [];
        groups[date].push(transaction);
    });
    const sortedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));
    return sortedDates.map(date => ({ date, transactions: groups[date] }));
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function calculateDateBalance(transactions) {
    return transactions.reduce((acc, t) => acc + t.amount, 0);
}

function updateTransactionList() {
    transactionListEl.innerHTML = '';
    if (transactions.length === 0) {
        transactionListEl.innerHTML = '<li class="empty-state">Нет операций. Добавьте первую транзакцию.</li>';
        return;
    }

    const groupedTransactions = groupTransactionsByDate(transactions);
    const collapsedDates = JSON.parse(localStorage.getItem('collapsedDates') || '[]');

    groupedTransactions.forEach(group => {
        const dateGroup = document.createElement('div');
        dateGroup.classList.add('date-group');
        if (collapsedDates.includes(group.date)) dateGroup.classList.add('collapsed');

        const dateBalance = calculateDateBalance(group.transactions);
        const dateHeader = document.createElement('div');
        dateHeader.classList.add('date-header');
        dateHeader.innerHTML = `
            <div class="date-header-left">
                <span class="date-chevron">▼</span>
                <span class="date-text">${formatDate(group.date)}</span>
            </div>
            <span class="date-balance">${formatCurrency(dateBalance)}</span>
        `;

        dateHeader.addEventListener('click', () => {
            dateGroup.classList.toggle('collapsed');
            saveCollapsedDates();
            if (isTelegramApp && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
        });
        dateGroup.appendChild(dateHeader);

        const transactionsContainer = document.createElement('div');
        transactionsContainer.classList.add('date-transactions');
        const sortedTransactions = [...group.transactions].sort((a, b) => b.id - a.id);

        sortedTransactions.forEach(transaction => {
            const li = document.createElement('li');
            li.classList.add('transaction-item');
            const sign = transaction.amount > 0 ? 'income' : 'expense';
            li.innerHTML = `
                <div class="transaction-info">
                    <div class="transaction-description">${transaction.description}</div>
                    <div class="transaction-amount ${sign}">${formatCurrency(Math.abs(transaction.amount))}</div>
                </div>
                <button class="btn-delete" onclick="removeTransaction(${transaction.id})">Удалить</button>
            `;
            transactionsContainer.appendChild(li);
        });

        dateGroup.appendChild(transactionsContainer);
        transactionListEl.appendChild(dateGroup);
    });
}

function saveCollapsedDates() {
    const collapsed = [];
    document.querySelectorAll('.date-group.collapsed').forEach(group => {
        const dateText = group.querySelector('.date-text')?.textContent;
        const allGroups = groupTransactionsByDate(transactions);
        allGroups.forEach(g => {
            if (formatDate(g.date) === dateText) collapsed.push(g.date);
        });
    });
    localStorage.setItem('collapsedDates', JSON.stringify(collapsed));
}

function addTransaction(e) {
    e.preventDefault();
    const description = descriptionInput.value.trim();
    const amount = parseFloat(amountInput.value);
    const selectedDate = dateInput.value || new Date().toISOString().split('T')[0];

    if (description === '' || isNaN(amount) || amount === 0) {
        if (isTelegramApp) tg.showAlert('Пожалуйста, заполните все поля корректно');
        else alert('Пожалуйста, заполните все поля корректно');
        return;
    }

    transactions.push({ id: generateID(), description, amount, date: selectedDate });
    saveData();
    updateUI();

    descriptionInput.value = '';
    amountInput.value = '';
    descriptionInput.focus();

    if (isTelegramApp && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
}

function removeTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveData();
    updateUI();
    if (isTelegramApp && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
}

function generateID() {
    return Date.now() + Math.random();
}

function formatCurrency(amount) {
    if (currentCurrency.code === 'UZS') {
        const formatted = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
        return `${formatted} ${currentCurrency.symbol}`;
    }
    return new Intl.NumberFormat(currentCurrency.locale, {
        style: 'currency', currency: currentCurrency.code, minimumFractionDigits: 0
