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
const themeToggle = document.getElementById('theme-toggle');

// ========================================
// Инициализация
// ========================================
async function init() {
    // Инициализация Telegram Mini App
    if (isTelegramApp) {
        tg.ready();
        tg.expand();

        // Применяем цветовую схему Telegram
        if (tg.colorScheme === 'dark') {
            currentTheme = 'dark';
        }

        // Загружаем данные из Telegram Cloud Storage
        await loadFromTelegramCloud();
    } else {
        // Локальная версия - используем localStorage
        transactions = JSON.parse(localStorage.getItem('transactions')) || [];
        currentTheme = localStorage.getItem('theme') || 'light';
    }

    applyTheme(currentTheme);
    updateUI();
    isDataLoaded = true;
}

// ========================================
// Telegram Cloud Storage
// ========================================
function loadFromTelegramCloud() {
    return new Promise((resolve) => {
        if (!isTelegramApp || !tg.CloudStorage) {
            resolve();
            return;
        }

        tg.CloudStorage.getItems(['transactions', 'theme'], (error, result) => {
            if (!error && result) {
                if (result.transactions) {
                    try {
                        transactions = JSON.parse(result.transactions);
                    } catch (e) {
                        transactions = [];
                    }
                }
                if (result.theme) {
                    currentTheme = result.theme;
                }
            }
            resolve();
        });
    });
}

function saveToTelegramCloud() {
    if (!isTelegramApp || !tg.CloudStorage) {
        return;
    }

    tg.CloudStorage.setItem('transactions', JSON.stringify(transactions), (error) => {
        if (error) {
            console.error('Ошибка сохранения в Telegram Cloud:', error);
        }
    });

    tg.CloudStorage.setItem('theme', currentTheme);
}

// ========================================
// Тема
// ========================================
function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    currentTheme = theme;

    // Сохраняем в соответствующее хранилище
    if (isTelegramApp) {
        saveToTelegramCloud();
    } else {
        localStorage.setItem('theme', theme);
    }
}

function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
}

// ========================================
// Обновление интерфейса
// ========================================
function updateUI() {
    updateBalance();
    updateTransactionList();
}

// ========================================
// Подсчет и отображение баланса
// ========================================
function updateBalance() {
    const amounts = transactions.map(t => t.amount);

    const total = amounts.reduce((acc, amount) => acc + amount, 0);
    const income = amounts
        .filter(amount => amount > 0)
        .reduce((acc, amount) => acc + amount, 0);
    const expense = amounts
        .filter(amount => amount < 0)
        .reduce((acc, amount) => acc + amount, 0);

    balanceEl.textContent = formatCurrency(total);
    incomeEl.textContent = formatCurrency(income);
    expenseEl.textContent = formatCurrency(Math.abs(expense));
}

// ========================================
// Группировка транзакций по датам
// ========================================
function groupTransactionsByDate(transactions) {
    const groups = {};

    transactions.forEach(transaction => {
        const date = transaction.date || new Date().toISOString().split('T')[0];
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(transaction);
    });

    // Сортировка дат в обратном порядке (новые сверху)
    const sortedDates = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));

    return sortedDates.map(date => ({
        date,
        transactions: groups[date]
    }));
}

// ========================================
// Форматирование даты
// ========================================
function formatDate(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Сброс времени для корректного сравнения
    today.setHours(0, 0, 0, 0);
    yesterday.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) {
        return 'Сегодня';
    } else if (date.getTime() === yesterday.getTime()) {
        return 'Вчера';
    } else {
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        return date.toLocaleDateString('ru-RU', options);
    }
}

// ========================================
// Подсчет баланса для даты
// ========================================
function calculateDateBalance(transactions) {
    return transactions.reduce((acc, t) => acc + t.amount, 0);
}

// ========================================
// Отображение списка транзакций
// ========================================
function updateTransactionList() {
    transactionListEl.innerHTML = '';

    if (transactions.length === 0) {
        transactionListEl.innerHTML = '<li class="empty-state">Нет операций. Добавьте первую транзакцию.</li>';
        return;
    }

    const groupedTransactions = groupTransactionsByDate(transactions);

    groupedTransactions.forEach(group => {
        const dateGroup = document.createElement('div');
        dateGroup.classList.add('date-group');

        const dateBalance = calculateDateBalance(group.transactions);
        const dateHeader = document.createElement('div');
        dateHeader.classList.add('date-header');
        dateHeader.innerHTML = `
            <span class="date-text">${formatDate(group.date)}</span>
            <span class="date-balance">${formatCurrency(dateBalance)}</span>
        `;

        dateGroup.appendChild(dateHeader);

        // Сортировка транзакций внутри дня (новые сверху)
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
                <button class="btn-delete" onclick="removeTransaction(${transaction.id})">
                    Удалить
                </button>
            `;

            dateGroup.appendChild(li);
        });

        transactionListEl.appendChild(dateGroup);
    });
}

// ========================================
// Добавление транзакции
// ========================================
function addTransaction(e) {
    e.preventDefault();

    const description = descriptionInput.value.trim();
    const amount = parseFloat(amountInput.value);

    if (description === '' || isNaN(amount) || amount === 0) {
        if (isTelegramApp) {
            tg.showAlert('Пожалуйста, заполните все поля корректно');
        } else {
            alert('Пожалуйста, заполните все поля корректно');
        }
        return;
    }

    const transaction = {
        id: generateID(),
        description: description,
        amount: amount,
        date: new Date().toISOString().split('T')[0] // Текущая дата в формате YYYY-MM-DD
    };

    transactions.push(transaction);
    saveData();
    updateUI();

    // Очистка формы
    descriptionInput.value = '';
    amountInput.value = '';
    descriptionInput.focus();

    // Haptic feedback в Telegram
    if (isTelegramApp && tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }
}

// ========================================
// Удаление транзакции
// ========================================
function removeTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveData();
    updateUI();

    // Haptic feedback в Telegram
    if (isTelegramApp && tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

// ========================================
// Генерация уникального ID
// ========================================
function generateID() {
    return Date.now() + Math.random();
}

// ========================================
// Форматирование валюты
// ========================================
function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// ========================================
// Сохранение данных
// ========================================
function saveData() {
    if (isTelegramApp) {
        saveToTelegramCloud();
    } else {
        localStorage.setItem('transactions', JSON.stringify(transactions));
    }
}

// Для обратной совместимости
function saveToLocalStorage() {
    saveData();
}

// ========================================
// Обработчики событий
// ========================================
form.addEventListener('submit', addTransaction);
themeToggle.addEventListener('click', toggleTheme);

// ========================================
// Запуск приложения
// ========================================
init();
