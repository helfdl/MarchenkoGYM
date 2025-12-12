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

class AdminMain {
    constructor() {
        this.checkAuth();
        this.init();
    }

    checkAuth() {
        const user = AuthService.getCurrentUser();
        if (!user || user.role !== 'admin') {
            if (window.router) {
                window.router.navigate('/');
            } else {
                window.location.href = '/';
            }
            return;
        }
    }

    cleanup() {
        
        
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

    async loadStatistics() {
        try {
            const response = await fetch('/api/admin/dashboard-stats', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const stats = await response.json();
                const totalUsersEl = document.getElementById('totalUsers');
                const activeClientsEl = document.getElementById('activeClients');
                const totalTrainersEl = document.getElementById('totalTrainers');
                const totalRevenueEl = document.getElementById('totalRevenue');
                
                if (totalUsersEl) totalUsersEl.textContent = stats.totalUsers || 0;
                if (activeClientsEl) activeClientsEl.textContent = stats.activeClients || 0;
                if (totalTrainersEl) totalTrainersEl.textContent = stats.totalTrainers || 0;
                if (totalRevenueEl) totalRevenueEl.textContent = `${stats.totalRevenue || 0} руб.`;
            }
        } catch (error) {
            
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
            const response = await fetch(`/api/admin/accounts/${user.user_id}`, {
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
                setTimeout(async () => {
                    window.closeProfileModal();
                    
                    await this.loadUserInfo();
                }, 1500);
            } else {
                this.showMessage(result.message || 'Ошибка обновления профиля', 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка обновления профиля', 'error');
        }
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('profileMessage');
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
        messageEl.classList.remove('hidden');

        setTimeout(() => {
            messageEl.classList.add('hidden');
        }, 5000);
    }

    async loadUserInfo() {
        const user = AuthService.getCurrentUser();
        if (user) {
            const userInfoEl = document.getElementById('userInfo');
            if (userInfoEl) {
                userInfoEl.textContent = `${user.first_name} ${user.last_name} (Администратор)`;
                userInfoEl.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.openProfileModal) {
                        window.openProfileModal();
                    }
                };
                userInfoEl.style.cursor = 'pointer';
            }
        }
    }

    static getPageContent() {
        return `
            <section class="hero">
                <div class="container">
                    <h1>Панель администратора</h1>
                    <p>Добро пожаловать в систему управления тренажерным залом «Сила»</p>
                </div>
            </section>

            <section class="features">
                <div class="container">
                    <h2 class="text-center">Быстрый доступ</h2>
                    <div class="row">
                        <div class="col">
                            <div class="card">
                                <h3>Учетные записи</h3>
                                <p>Просмотр, редактирование и удаление учетных записей пользователей</p>
                                <button class="btn btn-primary" onclick="router.navigate('/admin/accounts-management')">
                                    Перейти
                                </button>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card">
                                <h3>Тренеры</h3>
                                <p>Подтверждение регистрации тренеров и управление их профилями</p>
                                <button class="btn btn-primary" onclick="router.navigate('/admin/trainer-management')">
                                    Перейти
                                </button>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card">
                                <h3>Клиенты</h3>
                                <p>Поиск клиентов и просмотр статистики</p>
                                <button class="btn btn-primary" onclick="router.navigate('/admin/clients-management')">
                                    Перейти
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="row mt-4">
                        <div class="col">
                            <div class="card">
                                <h3>Абонементы</h3>
                                <p>Управление типами абонементов и их редактирование</p>
                                <button class="btn btn-primary" onclick="router.navigate('/admin/subscriptions')">
                                    Перейти
                                </button>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card">
                                <h3>Расписание</h3>
                                <p>Составление и управление расписанием занятий</p>
                                <button class="btn btn-primary" onclick="router.navigate('/admin/schedule')">
                                    Перейти
                                </button>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card">
                                <h3>Отчеты</h3>
                                <p>Аналитика и отчеты по работе зала</p>
                                <button class="btn btn-primary" onclick="router.navigate('/admin/reports')">
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
                    <div class="dashboard-grid">
                        <div class="card stat-card">
                            <h3>Всего пользователей</h3>
                            <p class="stat-number" id="totalUsers">0</p>
                        </div>
                        <div class="card stat-card">
                            <h3>Активных клиентов</h3>
                            <p class="stat-number" id="activeClients">0</p>
                        </div>
                        <div class="card stat-card">
                            <h3>Тренеров</h3>
                            <p class="stat-number" id="totalTrainers">0</p>
                        </div>
                        <div class="card stat-card">
                            <h3>Общая выручка</h3>
                            <p class="stat-number" id="totalRevenue">0 руб.</p>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }
}


window.AdminMain = AdminMain;