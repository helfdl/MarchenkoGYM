window.openProfileModal = function() {
    const modal = document.getElementById('profileModal');
    
    if (!modal) {
        return;
    }
    
    const user = (typeof AuthService !== 'undefined' && AuthService) ? AuthService.getCurrentUser() : null;
    
    if (user) {
        const firstNameEl = document.getElementById('profileFirstName');
        const lastNameEl = document.getElementById('profileLastName');
        const emailEl = document.getElementById('profileEmail');
        const phoneEl = document.getElementById('profilePhone');
        
        if (firstNameEl) firstNameEl.value = user.first_name || '';
        if (lastNameEl) lastNameEl.value = user.last_name || '';
        if (emailEl) emailEl.value = user.email || '';
        if (phoneEl) phoneEl.value = user.phone || '';
    }
    
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.closeProfileModal = function() {
    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    
    const messageEl = document.getElementById('profileMessage');
    if (messageEl) {
        messageEl.classList.add('hidden');
    }
};

class TrainerMain {
    constructor() {
        this.checkAuth();
        this.init();
    }

    checkAuth() {
        const user = AuthService.getCurrentUser();
        if (!user || user.role !== 'trainer') {
            if (window.router) {
                window.router.navigate('/');
            } else {
                window.location.href = '/';
            }
            return;
        }
    }

    cleanup() {
        // Очистка при переходе на другую страницу
    }

    async init() {
        await this.loadUserInfo();
        await this.loadStatistics();
        this.setupEventListeners();
        this.waitForElementAndSetup();
    }
    
    waitForElementAndSetup() {
        const checkElement = () => {
            const userInfoElement = document.getElementById('userInfo');
            if (userInfoElement && !userInfoElement.onclick) {
                this.setupProfileModalButton();
            } else if (!userInfoElement) {
                setTimeout(checkElement, 50);
            }
        };
        setTimeout(checkElement, 100);
    }
    
    setupProfileModalButton() {
        const userInfoElement = document.getElementById('userInfo');
        
        if (!userInfoElement) {
            return;
        }
        
        userInfoElement.removeAttribute('onclick');
        
        const newElement = userInfoElement.cloneNode(true);
        userInfoElement.parentNode.replaceChild(newElement, userInfoElement);
        
        newElement.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (window.openProfileModal) {
                window.openProfileModal();
            }
        }, true);
     
        newElement.style.cursor = 'pointer';
    }

    async loadUserInfo() {
        const user = AuthService.getCurrentUser();
        if (user) {
            const userInfoElement = document.getElementById('userInfo');
            if (userInfoElement) {
                userInfoElement.textContent = `${user.first_name} ${user.last_name} (Тренер)`;
                if (!userInfoElement.onclick && window.openProfileModal) {
                    userInfoElement.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        window.openProfileModal();
                    };
                    userInfoElement.style.cursor = 'pointer';
                }
            }
        }
    }

    setupEventListeners() {
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveProfile();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('profileModal');
                if (modal && !modal.classList.contains('hidden')) {
                    window.closeProfileModal();
                }
            }
        });
    }

    async saveProfile() {
        const user = AuthService.getCurrentUser();
        if (!user) return;

        const formData = {
            first_name: document.getElementById('profileFirstName').value,
            last_name: document.getElementById('profileLastName').value,
            email: document.getElementById('profileEmail').value,
            phone: document.getElementById('profilePhone').value
        };

        const password = document.getElementById('profilePassword').value;
        const confirmPassword = document.getElementById('profileConfirmPassword').value;

        if (password) {
            if (password !== confirmPassword) {
                this.showMessage('Пароли не совпадают', 'error');
                return;
            }
            formData.password = password;
        }

        try {
            const response = await fetch(`/api/trainer/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...AuthService.getAuthHeaders()
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                const updatedUser = { ...user, ...formData };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                this.showMessage('Профиль успешно обновлен', 'success');
                setTimeout(() => {
                    window.closeProfileModal();
                    // Обновляем информацию о пользователе без перезагрузки
                    this.loadUserInfo();
                }, 1500);
            } else {
                this.showMessage(result.message || 'Ошибка обновления профиля', 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка обновления профиля', 'error');
        }
    }

    async loadStatistics() {
        try {
            const response = await fetch('/api/trainer/dashboard-stats', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const stats = await response.json();
                this.renderStatistics(stats);
            }
        } catch (error) {
            // Ошибка загрузки статистики
        }
    }

    renderStatistics(stats) {
        const container = document.getElementById('dashboardStats');
        if (!container) return;

        const toNumber = (value) => {
            if (value === null || value === undefined) return 0;
            const num = Number(value);
            return Number.isNaN(num) ? 0 : num;
        };

        const totalSessions = toNumber(stats?.totalSessions);
        const totalClients = toNumber(stats?.totalClients);
        const todaySessions = toNumber(stats?.todaySessions);
        const totalVisits = toNumber(stats?.totalVisits);

        container.innerHTML = `
            <div class="dashboard-grid">
                <div class="card stat-card">
                    <h3>Всего тренировок</h3>
                    <p class="stat-number">${totalSessions}</p>
                </div>
                <div class="card stat-card">
                    <h3>Клиентов</h3>
                    <p class="stat-number">${totalClients}</p>
                </div>
                <div class="card stat-card">
                    <h3>Тренировок сегодня</h3>
                    <p class="stat-number">${todaySessions}</p>
                </div>
                <div class="card stat-card">
                    <h3>Всего посещений</h3>
                    <p class="stat-number">${totalVisits}</p>
                </div>
            </div>
        `;
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('profileMessage');
        if (messageEl) {
            messageEl.textContent = text;
            messageEl.className = `message ${type}`;
            messageEl.classList.remove('hidden');

            setTimeout(() => {
                messageEl.classList.add('hidden');
            }, 5000);
        }
    }

    static getPageContent() {
        return `
            <section class="hero">
                <div class="container">
                    <h1>Панель тренера</h1>
                    <p>Добро пожаловать в систему управления тренажерным залом «Сила»</p>
                </div>
            </section>

            <section class="features">
                <div class="container">
                    <h2 class="text-center">Быстрый доступ</h2>
                    <div class="row">
                        <div class="col">
                            <div class="card">
                                <h3>Расписание</h3>
                                <p>Просмотр и управление вашим расписанием тренировок</p>
                                <button class="btn btn-primary" onclick="router.navigate('/trainer/schedule')">
                                    Перейти
                                </button>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card">
                                <h3>Клиенты</h3>
                                <p>Список ваших клиентов и их записи на тренировки</p>
                                <button class="btn btn-primary" onclick="router.navigate('/trainer/clients')">
                                    Перейти
                                </button>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card">
                                <h3>Посещаемость</h3>
                                <p>Отметка посещаемости клиентов и статистика</p>
                                <button class="btn btn-primary" onclick="router.navigate('/trainer/attendance')">
                                    Перейти
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="features features-dark">
                <div class="container">
                    <h2 class="text-center">Статистика</h2>
                    <div id="dashboardStats" class="dashboard-grid"></div>
                </div>
            </section>
        `;
    }
}

// Инициализация происходит через router.js
window.TrainerMain = TrainerMain;