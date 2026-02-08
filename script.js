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
let currentCurrency = {
    code: 'RUB',
    symbol: '₽',
    locale: 'ru-RU'
};

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

// Элементы онбординга
const splashScreen = document.getElementById('splash-screen');
const greetingScreen = document.getElementById('greeting-screen');
const currencyScreen = document.getElementById('currency-screen');
const mainApp = document.getElementById('main-app');

// ========================================
// Онбординг - Анимированные переходы
// ========================================
function startOnboarding() {
    // Проверяем, показывали ли уже онбординг в этой сессии
    if (sessionStorage.getItem('onboardingShown')) {
        skipToApp();
        return;
    }

    // Настраиваем данные пользователя (аватар и имя)
    setupUserData();

    // Показываем splash screen (уже виден по умолчанию)
    // Через 1.5 секунды переходим к приветствию
    setTimeout(() => {
        transitionToGreeting();
    }, 1500);
}

// ========================================
// Получение данных пользователя из Telegram
// ========================================
function setupUserData() {
    const avatarEl = document.getElementById('user-avatar');
    const greetingTextEl = document.getElementById('greeting-text');

    if (isTelegramApp && tg.initDataUnsafe?.user) {
        const user = tg.initDataUnsafe.user;

        // Устанавливаем имя пользователя
        const firstName = user.first_name || 'Друг';
        greetingTextEl.textContent = `Привет, ${firstName}`;

        // Устанавливаем аватар пользователя из Telegram
        if (user.photo_url) {
            avatarEl.src = user.photo_url;
            avatarEl.onerror = () => {
                // Если аватар не загрузился - показываем инициалы
                showAvatarPlaceholder(avatarEl, firstName);
            };
        } else {
            // Нет фото - показываем инициалы
            showAvatarPlaceholder(avatarEl, firstName);
        }
    } else {
        // Не Telegram - показываем дефолтное приветствие
        greetingTextEl.textContent = 'Добро пожаловать';
        showAvatarPlaceholder(avatarEl, 'В');
    }
}

// ========================================
// Плейсхолдер аватара с инициалами
// ========================================
function showAvatarPlaceholder(avatarEl, name) {
    const initial = name.charAt(0).toUpperCase();
    const container = avatarEl.parentElement;

    // Скрываем img, создаём плейсхолдер
    avatarEl.style.display = 'none';

    const placeholder = document.createElement('div');
    placeholder.className = 'avatar-placeholder';
    placeholder.textContent = initial;
    placeholder.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-size: 3.5rem;
        font-weight: 600;
        border-radius: 50%;
    `;
    container.appendChild(placeholder);
}


function transitionToGreeting() {
    // Анимация исчезновения splash
    const splashContent = splashScreen.querySelector('.splash-content');
    splashContent.classList.add('splash-exit');

    setTimeout(() => {
        // Скрываем splash, показываем greeting
        splashScreen.classList.add('hidden');
        greetingScreen.classList.remove('hidden');

        // Через 2 секунды переходим к выбору валюты
        setTimeout(() => {
            transitionToCurrency();
        }, 2000);
    }, 600);
}

function transitionToCurrency() {
    // Анимация исчезновения greeting
    const greetingContent = greetingScreen.querySelector('.greeting-content');
    greetingContent.classList.add('greeting-exit');

    setTimeout(() => {
        // Скрываем greeting, показываем выбор валюты
        greetingScreen.classList.add('hidden');
        currencyScreen.classList.remove('hidden');

        // Инициализируем обработчики выбора валюты
        initCurrencySelection();
    }, 500);
}

function initCurrencySelection() {
    const currencyOptions = document.querySelectorAll('.currency-option');
    currencyOptions.forEach(option => {
        option.addEventListener('click', () => {
            selectCurrency(option);
        });
    });
}

function selectCurrency(option) {
    // Получаем данные валюты
    currentCurrency = {
        code: option.dataset.currency,
        symbol: option.dataset.symbol,
        locale: option.dataset.locale
    };

    // Сохраняем выбор
    saveCurrency();

    // Haptic feedback
    if (isTelegramApp && tg.HapticFeedback) {
        tg.HapticFeedback.selectionChanged();
    }

    // Переходим к приложению
    transitionToApp();
}

function transitionToApp() {
    // Анимация исчезновения текущего экрана
    const currencyContent = currencyScreen.querySelector('.currency-content');
    if (currencyContent) {
        currencyContent.classList.add('currency-exit');
    }

    setTimeout(() => {
        // Скрываем все экраны онбординга, показываем app
        splashScreen.classList.add('hidden');
        greetingScreen.classList.add('hidden');
        currencyScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        mainApp.classList.add('app-enter');

        // Отмечаем что онбординг показан
        sessionStorage.setItem('onboardingShown', 'true');
        onboardingComplete = true;

        // Обновляем UI с выбранной валютой
        updateUI();

        // Haptic feedback для Telegram
        if (isTelegramApp && tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
    }, 500);
}

function skipToApp() {
    // Пропускаем онбординг - сразу показываем приложение
    splashScreen.classList.add('hidden');
    greetingScreen.classList.add('hidden');
    currencyScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    mainApp.style.opacity = '1';
    mainApp.style.transform = 'scale(1)';
    onboardingComplete = true;
}


// ========================================
// Инициализация
// ========================================
async function init() {
    // Устанавливаем сегодняшнюю дату по умолчанию
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.max = today; // Нельзя выбрать будущую дату

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

    // Загружаем сохраненную валюту
    await loadCurrency();

    applyTheme(currentTheme);
    updateUI();
    isDataLoaded = true;

    // Запуск онбординга
    startOnboarding();
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
// Форматирование даты (всегда число и месяц)
// ========================================
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { day: 'numeric', month: 'long' };
    return date.toLocaleDateString('ru-RU', options);
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
            <div class="date-header-left">
                <span class="date-chevron">▼</span>
                <span class="date-text">${formatDate(group.date)}</span>
            </div>
            <span class="date-balance">${formatCurrency(dateBalance)}</span>
        `;

        // Обработчик клика для сворачивания/разворачивания
        dateHeader.addEventListener('click', () => {
            dateGroup.classList.toggle('collapsed');
            // Haptic feedback
            if (isTelegramApp && tg.HapticFeedback) {
                tg.HapticFeedback.selectionChanged();
            }
        });

        dateGroup.appendChild(dateHeader);

        // Контейнер для транзакций (сворачиваемый)
        const transactionsContainer = document.createElement('div');
        transactionsContainer.classList.add('date-transactions');

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

            transactionsContainer.appendChild(li);
        });

        dateGroup.appendChild(transactionsContainer);
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
    const selectedDate = dateInput.value || new Date().toISOString().split('T')[0];

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
        date: selectedDate
    };

    transactions.push(transaction);
    saveData();
    updateUI();

    // Очистка формы (кроме даты)
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
    // Для узбекского сума используем простое форматирование (Intl не поддерживает UZS хорошо)
    if (currentCurrency.code === 'UZS') {
        const formatted = new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
        return `${formatted} ${currentCurrency.symbol}`;
    }

    return new Intl.NumberFormat(currentCurrency.locale, {
        style: 'currency',
        currency: currentCurrency.code,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

// ========================================
// Сохранение и загрузка валюты
// ========================================
function saveCurrency() {
    if (isTelegramApp && tg.CloudStorage) {
        tg.CloudStorage.setItem('currency', JSON.stringify(currentCurrency));
    } else {
        localStorage.setItem('currency', JSON.stringify(currentCurrency));
    }
}

function loadCurrency() {
    return new Promise((resolve) => {
        if (isTelegramApp && tg.CloudStorage) {
            tg.CloudStorage.getItem('currency', (error, result) => {
                if (!error && result) {
                    try {
                        currentCurrency = JSON.parse(result);
                    } catch (e) {
                        // Используем дефолтную валюту
                    }
                }
                resolve();
            });
        } else {
            const saved = localStorage.getItem('currency');
            if (saved) {
                try {
                    currentCurrency = JSON.parse(saved);
                } catch (e) {
                    // Используем дефолтную валюту
                }
            }
            resolve();
        }
    });
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
// Микроанимации - Ripple эффект
// ========================================
function createRipple(event) {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();

    const ripple = document.createElement('span');
    ripple.classList.add('ripple');

    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (event.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (event.clientY - rect.top - size / 2) + 'px';

    button.appendChild(ripple);

    ripple.addEventListener('animationend', () => {
        ripple.remove();
    });
}

// Добавляем ripple эффект к кнопкам
document.querySelectorAll('.btn-add, .btn-delete, .theme-toggle').forEach(button => {
    button.addEventListener('click', createRipple);
});

// ========================================
// Анимация при скролле (IntersectionObserver)
// ========================================
function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Наблюдаем за секциями
    document.querySelectorAll('.balance-section, .transactions-section, .add-section').forEach(section => {
        section.classList.add('scroll-animate');
        observer.observe(section);
    });
}

// Добавляем стили для scroll-анимации динамически
const scrollAnimationStyles = document.createElement('style');
scrollAnimationStyles.textContent = `
    .scroll-animate {
        opacity: 0;
        transform: translateY(30px);
        transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), 
                    transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .scroll-animate.animate-in {
        opacity: 1;
        transform: translateY(0);
    }
    
    .balance-section.scroll-animate { transition-delay: 0s; }
    .transactions-section.scroll-animate { transition-delay: 0.1s; }
    .add-section.scroll-animate { transition-delay: 0.2s; }
`;
document.head.appendChild(scrollAnimationStyles);

// Инициализация scroll анимаций после загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupScrollAnimations);
} else {
    setupScrollAnimations();
}

// ========================================
// Запуск приложения
// ========================================
init();
