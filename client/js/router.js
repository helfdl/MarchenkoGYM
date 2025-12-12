class Router {
    constructor() {
        this.routes = {
            '/': 'home',
            '/admin': 'admin-home',
            '/admin/accounts-management': 'admin-accounts',
            '/admin/trainer-management': 'admin-trainers',
            '/admin/clients-management': 'admin-clients',
            '/admin/subscriptions': 'admin-subscriptions',
            '/admin/schedule': 'admin-schedule',
            '/admin/reports': 'admin-reports',
            '/client': 'client-home',
            '/client/subscriptions': 'client-subscriptions',
            '/client/bookings': 'client-bookings',
            '/client/my-bookings': 'client-my-bookings',
            '/client/statistics': 'client-statistics',
            '/trainer': 'trainer-home',
            '/trainer/schedule': 'trainer-schedule',
            '/trainer/clients': 'trainer-clients',
            '/trainer/attendance': 'trainer-attendance'
        };
        
        this.currentRoute = null;
        this.currentPage = null;
        this.init();
    }

    init() {
        
        window.addEventListener('popstate', () => this.handleRoute());
        document.addEventListener('click', (e) => {
            
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                return;
            }
            
            const link = e.target.closest('a[href]');
            if (link && link.href.startsWith(window.location.origin)) {
                const href = link.getAttribute('href');
                
                if (href.startsWith('#')) {
                    const targetId = href.substring(1);
                    if (window.location.pathname === '/') {
                        const targetElement = document.getElementById(targetId);
                        if (targetElement) {
                            e.preventDefault();
                            setTimeout(() => {
                                const yOffset = -80; 
                                const y = targetElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
                                window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
                            }, 50);
                            return;
                        }
                    } else {
                        e.preventDefault();
                        window.location.hash = href;
                        this.navigate('/');
                        return;
                    }
                }
                
                if (!href.startsWith('#') && !href.startsWith('javascript:')) {
                    e.preventDefault();
                    this.navigate(href);
                }
            }
        });
        
        this.handleRoute();
    }

    navigate(path) {
        window.history.pushState({}, '', path);
        this.handleRoute();
    }

    async handleRoute() {
        const path = window.location.pathname;
        const route = this.routes[path] || 'home';
        
        if (this.currentRoute === route) {
            return;
        }
        
        this.currentRoute = route;
        await this.loadPage(route);
    }

    async loadPage(pageName) {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) {
            
            return;
        }

        
        if (this.currentPage && this.currentPage.cleanup) {
            this.currentPage.cleanup();
        }
        
        
        mainContent.style.opacity = '0';
        mainContent.style.transition = 'opacity 0.1s';

        
        const user = AuthService.getCurrentUser();
        if (user) {
            AuthService.updateNavigation(user);
        }
        
        await this.loadPageScripts(pageName);
                
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const content = this.getPageContent(pageName);
        mainContent.innerHTML = content;
                
        setTimeout(() => {
            mainContent.style.opacity = '1';
        }, 10);
        
        this.initializePage(pageName);
               
        this.initializeProfile();
    }
    
    initializeProfile() {
        
        setTimeout(() => {
            const userInfoElement = document.getElementById('userInfo');
            const profileForm = document.getElementById('profileForm');
            
            if (userInfoElement && !userInfoElement.hasAttribute('data-profile-initialized')) {
                userInfoElement.setAttribute('data-profile-initialized', 'true');
                userInfoElement.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.openProfileModal) {
                        window.openProfileModal();
                    }
                }, true);
                userInfoElement.style.cursor = 'pointer';
            }
            
            
            if (profileForm && !profileForm.hasAttribute('data-profile-form-initialized')) {
                profileForm.setAttribute('data-profile-form-initialized', 'true');
                const routerInstance = this;
                profileForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await routerInstance.saveProfile();
                });
            }
        }, 150);
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

        const nameRegex = /^[A-Za-zА-Яа-яЁё]+$/;
        const phoneRegex = /^[0-9+\-]+$/;

        if (!nameRegex.test(formData.first_name) || !nameRegex.test(formData.last_name)) {
            this.showProfileMessage('Имя и фамилия должны содержать только буквы', 'error');
            return;
        }

        if (formData.phone && !phoneRegex.test(formData.phone)) {
            this.showProfileMessage('Номер телефона может содержать только цифры, а также символы + и -', 'error');
            return;
        }

        if (password) {
            if (password !== confirmPassword) {
                this.showProfileMessage('Пароли не совпадают', 'error');
                return;
            }
            formData.password = password;
        }

        try {
            let url = '';
            if (user.role === 'admin') {
                url = `/api/admin/accounts/${user.user_id}`;
            } else if (user.role === 'client') {
                url = `/api/client/profile`;
            } else if (user.role === 'trainer') {
                url = `/api/trainer/profile`;
            }
            
            const response = await fetch(url, {
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
                this.showProfileMessage('Профиль успешно обновлен', 'success');
                setTimeout(() => {
                    if (window.closeProfileModal) {
                        window.closeProfileModal();
                    }
                    
                    AuthService.updateNavigation(updatedUser);
                }, 1500);
            } else {
                this.showProfileMessage(result.message || 'Ошибка обновления профиля', 'error');
            }
        } catch (error) {
            this.showProfileMessage('Ошибка обновления профиля', 'error');
        }
    }
    
    showProfileMessage(text, type) {
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

    getPageContent(pageName) {
        
        switch(pageName) {
            case 'admin-accounts':
                return typeof AccountsManagement !== 'undefined' && AccountsManagement.getPageContent 
                    ? AccountsManagement.getPageContent() 
                    : this.getAdminAccountsContent();
            case 'admin-trainers':
                return typeof TrainerManagement !== 'undefined' && TrainerManagement.getPageContent 
                    ? TrainerManagement.getPageContent() 
                    : this.getAdminTrainersContent();
            case 'admin-clients':
                return typeof ClientManagement !== 'undefined' && ClientManagement.getPageContent 
                    ? ClientManagement.getPageContent() 
                    : this.getAdminClientsContent();
            case 'admin-subscriptions':
                return typeof SubscriptionManagement !== 'undefined' && SubscriptionManagement.getPageContent 
                    ? SubscriptionManagement.getPageContent() 
                    : this.getAdminSubscriptionsContent();
            case 'admin-schedule':
                return typeof ScheduleManagement !== 'undefined' && ScheduleManagement.getPageContent 
                    ? ScheduleManagement.getPageContent() 
                    : this.getAdminScheduleContent();
            case 'admin-reports':
                return typeof AdminReports !== 'undefined' && AdminReports.getPageContent 
                    ? AdminReports.getPageContent() 
                    : this.getAdminReportsContent();
            case 'admin-home':
                return typeof AdminMain !== 'undefined' && AdminMain.getPageContent 
                    ? AdminMain.getPageContent() 
                    : this.getAdminHomeContent();
            case 'client-home':
                return typeof window.ClientMain !== 'undefined' && window.ClientMain.getPageContent
                    ? window.ClientMain.getPageContent() 
                    : this.getClientHomeContent();
            case 'client-subscriptions':
                return typeof ClientSubscriptions !== 'undefined' && ClientSubscriptions.getPageContent 
                    ? ClientSubscriptions.getPageContent() 
                    : this.getClientSubscriptionsContent();
            case 'client-bookings':
                return typeof ClientBookings !== 'undefined' && ClientBookings.getPageContent 
                    ? ClientBookings.getPageContent() 
                    : this.getClientBookingsContent();
            case 'client-my-bookings':
                return typeof ClientMyBookings !== 'undefined' && ClientMyBookings.getPageContent 
                    ? ClientMyBookings.getPageContent() 
                    : this.getClientMyBookingsContent();
            case 'client-statistics':
                return typeof ClientStatistics !== 'undefined' && ClientStatistics.getPageContent 
                    ? ClientStatistics.getPageContent() 
                    : this.getClientStatisticsContent();
            case 'trainer-home':
                return typeof TrainerMain !== 'undefined' && TrainerMain.getPageContent 
                    ? TrainerMain.getPageContent() 
                    : this.getTrainerHomeContent();
            case 'trainer-schedule':
                return typeof TrainerSchedule !== 'undefined' && TrainerSchedule.getPageContent 
                    ? TrainerSchedule.getPageContent() 
                    : this.getTrainerScheduleContent();
            case 'trainer-clients':
                return typeof TrainerClients !== 'undefined' && TrainerClients.getPageContent 
                    ? TrainerClients.getPageContent() 
                    : this.getTrainerClientsContent();
            case 'trainer-attendance':
                return typeof TrainerAttendance !== 'undefined' && TrainerAttendance.getPageContent 
                    ? TrainerAttendance.getPageContent() 
                    : this.getTrainerAttendanceContent();
            case 'home':
            default:
                return this.getHomeContent();
        }
    }

    getHomeContent() {
        return `
            <section class="hero">
                <div class="container">
                    <h1>Добро пожаловать в тренажерный зал «Сила»</h1>
                    <p>Новый зал в Минске с современным оборудованием, профессиональными тренерами и удобным расписанием</p>
                    <button class="btn btn-primary" onclick="openRegisterModal()">Начать тренироваться</button>
                </div>
            </section>

            <section class="features">
                <div class="container">
                    <h2 class="text-center">О нас</h2>
                    <div class="row">
                        <div class="col">
                            <div class="card">
                                <h3>Современное оборудование</h3>
                                <p>Тренажеры последнего поколения от ведущих мировых производителей</p>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card">
                                <h3>Профессиональные тренеры</h3>
                                <p>Опытные специалисты с индивидуальным подходом к каждому клиенту</p>
                            </div>
                        </div>
                        <div class="col">
                            <div class="card">
                                <h3>Гибкий график</h3>
                                <p>Работаем с 6:00 до 24:00 без выходных</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="schedule" class="schedule-preview">
                <div class="container">
                    <h2 class="text-center">Расписание занятий</h2>
                    <div class="schedule-controls">
                        <div class="session-filters" id="sessionFilters">
                            <button class="filter-btn active" onclick="calendar.setSessionType('all')">Все занятия</button>
                            <button class="filter-btn" onclick="calendar.setSessionType('individual')">Индивидуальные</button>
                            <button class="filter-btn" onclick="calendar.setSessionType('group')">Групповые</button>
                        </div>
                    </div>
                    <div id="schedule-list" class="calendar-container"></div>
                </div>
            </section>

            <section id="trainers" class="features">
                <div class="container">
                    <h2 class="text-center">Наши тренеры</h2>
                    <div id="trainers-list" class="row"></div>
                </div>
            </section>

            <section id="pricing" class="subscriptions-section">
                <div class="container">
                    <h2 class="text-center">Абонементы</h2>
                    <div class="subscription-controls">
                        <select class="category-select" onchange="subscriptionManager.setCategory(this.value)">
                            <option value="all">Все категории абонементов</option>
                            <option value="gym">Тренажерный зал</option>
                            <option value="group">Групповые тренировки</option>
                            <option value="combined">Комбинированные</option>
                        </select>
                    </div>
                    <div id="subscriptions-list" class="subscription-categories"></div>
                </div>
            </section>
        `;
    }

        
    getAdminHomeContent() {
        return '<div class="container"><p>Загрузка...</p></div>';
    }

    getAdminAccountsContent() {
        return '<div class="container"><p>Загрузка...</p></div>';
    }

    getAdminTrainersContent() {
        return '<div class="container"><p>Загрузка...</p></div>';
    }

    getAdminClientsContent() {
        return '<div class="container"><p>Загрузка...</p></div>';
    }

    getAdminSubscriptionsContent() {
        return '<div class="container"><p>Загрузка...</p></div>';
    }

    getAdminScheduleContent() {
        return '<div class="container"><p>Загрузка...</p></div>';
    }

    getAdminReportsContent() {
        return '<div class="container"><p>Загрузка...</p></div>';
    }

    getClientHomeContent() {
        return '<div class="container"><p>Загрузка...</p></div>';
    }

    getClientSubscriptionsContent() {
        return '<div class="container"><p>Загрузка...</p></div>';
    }

    getClientBookingsContent() {
        return '<div class="container"><p>Загрузка...</p></div>';
    }

    getClientMyBookingsContent() {
        return '<div class="container"><p>Загрузка...</p></div>';
    }

    getClientStatisticsContent() {
        return '<div class="container"><p>Загрузка...</p></div>';
    }

    getTrainerHomeContent() {
        return '<div class="container"><p>Загрузка...</p></div>';
    }

    getTrainerScheduleContent() {
        return '<div class="container"><p>Загрузка...</p></div>';
    }

    getTrainerClientsContent() {
        return '<div class="container"><p>Загрузка...</p></div>';
    }

    getTrainerAttendanceContent() {
        return '<div class="container"><p>Загрузка...</p></div>';
    }

    async loadPageScripts(pageName) {
        const scripts = {
            'home': ['/js/guest/schedule.js', '/js/guest/trainers.js', '/js/guest/subscription.js'],
            'admin-home': ['/js/admin/main.js'],
            'admin-accounts': ['/js/admin/accountsManagement.js'],
            'admin-trainers': ['/js/admin/trainerManagement.js'],
            'admin-clients': ['/js/admin/clientManagement.js'],
            'admin-subscriptions': ['/js/admin/subscriptionManagement.js'],
            'admin-schedule': ['/js/admin/scheduleManagement.js'],
            'admin-reports': ['/js/admin/reports.js'],
            'client-home': ['/js/client/main.js'],
            'client-subscriptions': ['/js/client/subscriptions.js'],
            'client-bookings': ['/js/client/bookings.js'],
            'client-my-bookings': ['/js/client/myBookings.js'],
            'client-statistics': ['/js/client/statistics.js'],
            'trainer-home': ['/js/trainer/main.js'],
            'trainer-schedule': ['/js/trainer/schedule.js'],
            'trainer-clients': ['/js/trainer/clients.js'],
            'trainer-attendance': ['/js/trainer/attendance.js']
        };

        const scriptPaths = scripts[pageName] || [];
        
        await Promise.all(scriptPaths.map(scriptPath => this.loadScript(scriptPath)));
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) {
                
                setTimeout(resolve, 50);
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.setAttribute('data-page-script', 'true');
            script.onload = () => {
                
                setTimeout(resolve, 50);
            };
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }

    initializePage(pageName) {
                
        setTimeout(() => {
            
            if (window.location.hash) {
                const hash = window.location.hash.substring(1);
                const targetElement = document.getElementById(hash);
                if (targetElement) {
                    setTimeout(() => {
                        const yOffset = -80; 
                        const y = targetElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
                        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
                    }, 200);
                }
            }
            
            if (pageName === 'home') {
                
                
                const scheduleList = document.getElementById('schedule-list');
                const trainersList = document.getElementById('trainers-list');
                const subscriptionsList = document.getElementById('subscriptions-list');
                
                
                if (scheduleList) {
                    
                    if (window.schedule && typeof window.schedule.loadSchedule === 'function') {
                        window.schedule.loadSchedule();
                    } else if (window.calendar && typeof window.calendar.loadSchedule === 'function') {
                        window.calendar.loadSchedule();
                    } else if (window.Schedule) {
                        
                        const schedule = new window.Schedule();
                        schedule.loadSchedule();
                    }
                }
                
                
                if (trainersList) {
                    if (window.Trainers && typeof window.Trainers.loadTrainers === 'function') {
                        window.Trainers.loadTrainers();
                    }
                }
                
                
                if (subscriptionsList) {
                    if (window.subscription && typeof window.subscription.loadSubscriptions === 'function') {
                        window.subscription.loadSubscriptions();
                    } else if (window.subscriptionManager && typeof window.subscriptionManager.loadSubscriptions === 'function') {
                        window.subscriptionManager.loadSubscriptions();
                    } else if (window.Subscription) {
                        
                        const subscription = new window.Subscription();
                        subscription.loadSubscriptions();
                    }
                }
            } else if (pageName === 'admin-home' && typeof AdminMain !== 'undefined') {
                if (window.adminMainInstance) {
                    window.adminMainInstance.cleanup();
                }
                window.adminMainInstance = new AdminMain();
            } else if (pageName === 'client-home' && typeof window.ClientMain !== 'undefined') {
                if (window.clientMainInstance) {
                    window.clientMainInstance.cleanup();
                }
                
                setTimeout(() => {
                    window.clientMainInstance = new window.ClientMain();
                }, 50);
            } else if (pageName === 'client-subscriptions' && typeof ClientSubscriptions !== 'undefined') {
                if (window.clientSubscriptionsInstance) {
                    window.clientSubscriptionsInstance.cleanup && window.clientSubscriptionsInstance.cleanup();
                }
                setTimeout(() => {
                    window.clientSubscriptionsInstance = new ClientSubscriptions();
                }, 50);
            } else if (pageName === 'client-bookings' && typeof ClientBookings !== 'undefined') {
                if (window.clientBookingsInstance) {
                    window.clientBookingsInstance.cleanup && window.clientBookingsInstance.cleanup();
                }
                setTimeout(() => {
                    window.clientBookingsInstance = new ClientBookings();
                }, 50);
            } else if (pageName === 'client-my-bookings' && typeof ClientMyBookings !== 'undefined') {
                if (window.clientMyBookingsInstance) {
                    window.clientMyBookingsInstance.cleanup && window.clientMyBookingsInstance.cleanup();
                }
                window.clientMyBookingsInstance = new ClientMyBookings();
            } else if (pageName === 'client-statistics' && typeof ClientStatistics !== 'undefined') {
                if (window.clientStatisticsInstance) {
                    window.clientStatisticsInstance.cleanup && window.clientStatisticsInstance.cleanup();
                }
                window.clientStatisticsInstance = new ClientStatistics();
            } else if (pageName === 'trainer-home' && typeof TrainerMain !== 'undefined') {
                if (window.trainerMainInstance) {
                    window.trainerMainInstance.cleanup();
                }
                window.trainerMainInstance = new TrainerMain();
            } else if (pageName === 'trainer-schedule' && typeof TrainerSchedule !== 'undefined') {
                if (window.trainerScheduleInstance) {
                    window.trainerScheduleInstance.cleanup && window.trainerScheduleInstance.cleanup();
                }
                window.trainerScheduleInstance = new TrainerSchedule();
            } else if (pageName === 'trainer-clients' && typeof TrainerClients !== 'undefined') {
                if (window.trainerClientsInstance) {
                    window.trainerClientsInstance.cleanup && window.trainerClientsInstance.cleanup();
                }
                window.trainerClientsInstance = new TrainerClients();
            } else if (pageName === 'trainer-attendance' && typeof TrainerAttendance !== 'undefined') {
                if (window.trainerAttendanceInstance) {
                    window.trainerAttendanceInstance.cleanup && window.trainerAttendanceInstance.cleanup();
                }
                window.trainerAttendanceInstance = new TrainerAttendance();
            } else if (pageName === 'admin-accounts' && typeof AccountsManagement !== 'undefined') {
                if (window.accountsManagementInstance) {
                    window.accountsManagementInstance.cleanup && window.accountsManagementInstance.cleanup();
                }
                window.accountsManagementInstance = new AccountsManagement();
            } else if (pageName === 'admin-trainers' && typeof TrainerManagement !== 'undefined') {
                if (window.trainerManagementInstance) {
                    window.trainerManagementInstance.cleanup && window.trainerManagementInstance.cleanup();
                }
                window.trainerManagementInstance = new TrainerManagement();
            } else if (pageName === 'admin-clients' && typeof ClientManagement !== 'undefined') {
                if (window.clientManagementInstance) {
                    window.clientManagementInstance.cleanup && window.clientManagementInstance.cleanup();
                }
                window.clientManagementInstance = new ClientManagement();
            } else if (pageName === 'admin-subscriptions' && typeof SubscriptionManagement !== 'undefined') {
                if (window.subscriptionManagementInstance) {
                    window.subscriptionManagementInstance.cleanup && window.subscriptionManagementInstance.cleanup();
                }
                window.subscriptionManagementInstance = new SubscriptionManagement();
            } else if (pageName === 'admin-schedule' && typeof ScheduleManagement !== 'undefined') {
                if (window.scheduleManagementInstance) {
                    window.scheduleManagementInstance.cleanup && window.scheduleManagementInstance.cleanup();
                }
                window.scheduleManagementInstance = new ScheduleManagement();
            } else if (pageName === 'admin-reports' && typeof AdminReports !== 'undefined') {
                if (window.reportsInstance) {
                    window.reportsInstance.cleanup && window.reportsInstance.cleanup();
                }
                
                window.reportsInstance = new AdminReports();
            }
        }, 300);
    }
}


let router;
document.addEventListener('DOMContentLoaded', () => {
    router = new Router();
    window.router = router;
    
    
    
});

