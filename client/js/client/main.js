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

class ClientMain {
    constructor() {
        this.checkAuth();
        this.selectedSessionType = 'all';
        this.selectedCategory = 'all';
        this.sessions = [];
        this.subscriptionTypes = [];
        this.currentDate = this.getWeekStart(new Date());
        this.init();
    }

    checkAuth() {
        const user = AuthService.getCurrentUser();
        if (!user || user.role !== 'client') {
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
        await this.loadSchedule();
        await this.loadTrainers();
        await this.loadSubscriptionTypes();
        await this.loadNotifications();
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
                userInfoElement.textContent = user.first_name + ' ' + user.last_name + ' (Клиент)';
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

        const purchaseForm = document.getElementById('purchaseForm');
        if (purchaseForm) {
            purchaseForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.purchaseSubscription();
            });
        }

        
        setTimeout(() => {
            document.querySelectorAll('#sessionFilters .filter-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const type = e.target.getAttribute('data-type') || 'all';
                    this.setSessionType(type, e.target);
                });
            });
        }, 100);

        
        setTimeout(() => {
            const categorySelect = document.getElementById('subscriptionCategory');
            if (categorySelect) {
                categorySelect.addEventListener('change', (e) => {
                    this.setCategory(e.target.value);
                });
            }
        }, 100);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const profileModal = document.getElementById('profileModal');
                if (profileModal && !profileModal.classList.contains('hidden')) {
                    window.closeProfileModal();
                }
                const purchaseModal = document.getElementById('purchaseModal');
                if (purchaseModal && !purchaseModal.classList.contains('hidden')) {
                    ClientMain.closePurchaseModal();
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
            const authHeaders = AuthService.getAuthHeaders();
            const headers = {
                'Content-Type': 'application/json'
            };
            Object.assign(headers, authHeaders);
            
            const response = await fetch(`/api/client/profile`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                const updatedUser = Object.assign({}, user, formData);
                localStorage.setItem('user', JSON.stringify(updatedUser));
                this.showMessage('Профиль успешно обновлен', 'success', 'profileMessage');
                setTimeout(() => {
                    window.closeProfileModal();
                    
                    this.loadUserInfo();
                }, 1500);
            } else {
                this.showMessage(result.message || 'Ошибка обновления профиля', 'error', 'profileMessage');
            }
        } catch (error) {
            this.showMessage('Ошибка обновления профиля', 'error', 'profileMessage');
        }
    }

    showMessage(text, type, elementId = 'purchaseMessage') {
        const messageEl = document.getElementById(elementId);
        if (messageEl) {
            messageEl.textContent = text;
            messageEl.className = 'message ' + type;
            messageEl.classList.remove('hidden');

            setTimeout(() => {
                messageEl.classList.add('hidden');
            }, 5000);
        }
    }

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    async loadSchedule() {
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const container = document.getElementById('schedule-list');
        if (!container) {
            
            setTimeout(() => this.loadSchedule(), 200);
            return;
        }
        
        try {
            container.innerHTML = '<p>Загрузка расписания...</p>';
            const response = await fetch('/api/public/schedule', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                this.sessions = await response.json();
                this.renderCalendar();
                this.updateFilterButtons();
            } else {
                const error = await response.json().catch(() => ({ message: 'Неизвестная ошибка' }));
                container.innerHTML = '<p style="color: red;">Ошибка загрузки расписания: ' + (error.message || 'Неизвестная ошибка') + '</p>';
            }
        } catch (error) {
            if (container) {
                container.innerHTML = '<p style="color: red;">Ошибка загрузки расписания. Проверьте подключение к серверу.</p>';
            }
        }
    }

    renderCalendar() {
        const container = document.getElementById('schedule-list');
        if (!container) return;

        if (!this.sessions || this.sessions.length === 0) {
            container.innerHTML = '<p>Расписание временно недоступно</p>';
            return;
        }

        const weekStart = this.getWeekStart(this.currentDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const weekStartStr = weekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
        const weekEndStr = weekEnd.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        const weekRange = weekStartStr + ' - ' + weekEndStr;

        const calendarHTML = '<div class="calendar">' +
            '<div class="calendar-navigation">' +
            '<button class="calendar-nav-btn" onclick="ClientMain.prevWeek()">← Пред неделя</button>' +
            '<div class="current-month">' + weekRange + '</div>' +
            '<button class="calendar-nav-btn" onclick="ClientMain.nextWeek()">След неделя →</button>' +
            '</div>' +
            '<div class="calendar-grid" id="calendarGrid">' +
            '<div class="calendar-day-header">Понедельник</div>' +
            '<div class="calendar-day-header">Вторник</div>' +
            '<div class="calendar-day-header">Среда</div>' +
            '<div class="calendar-day-header">Четверг</div>' +
            '<div class="calendar-day-header">Пятница</div>' +
            '<div class="calendar-day-header">Суббота</div>' +
            '<div class="calendar-day-header">Воскресенье</div>' +
            '</div>' +
            '</div>';

        container.innerHTML = calendarHTML;
        this.renderCalendarDays();
    }

    renderCalendarDays() {
        const calendarGrid = document.getElementById('calendarGrid');
        if (!calendarGrid) return;
        
        const days = calendarGrid.querySelectorAll('.calendar-day');
        days.forEach(day => day.remove());

        const weekStart = this.getWeekStart(this.currentDate);
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(weekStart.getDate() + i);
            calendarGrid.appendChild(this.createDayElement(date));
        }
    }

    createDayElement(date) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateCopy = new Date(date);
        dateCopy.setHours(0, 0, 0, 0);
        
        if (dateCopy.getTime() === today.getTime()) {
            dayElement.classList.add('today');
        }

        // Форматируем дату в формате YYYY-MM-DD без использования toISOString
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        const daySessions = this.getSessionsForDate(date);
        
        const dayNumber = date.getDate();
        const dayName = date.toLocaleDateString('ru-RU', { weekday: 'short' });
        const sessionsHtml = daySessions.map(function(session) {
            return this.createSessionElement(session);
        }.bind(this)).join('');
        
        dayElement.innerHTML = '<div class="day-number">' + dayNumber + '</div>' +
            '<div class="day-name">' + dayName + '</div>' +
            '<div class="calendar-sessions">' +
            sessionsHtml +
            '</div>';

        return dayElement;
    }

    createSessionElement(session) {
        const sessionType = session.session_type === 'individual' ? 'individual' : 'group';
        const time = session.start_time.slice(0, 5);
        const trainerName = session.trainer_first_name ? (session.trainer_first_name + ' ' + (session.trainer_last_name || '')).trim() : 'Тренер';
        const sessionName = session.name || 'Тренировка';
        const sessionNameHtml = session.name ? '<div class="session-program">' + session.name + '</div>' : '';
        
        return '<div class="session-item ' + sessionType + '" ' +
               'onclick="ClientMain.openSessionModal(' + session.schedule_id + ')" ' +
               'title="' + trainerName + ' - ' + sessionName + '">' +
               '<div class="session-time">' + time + '</div>' +
               '<div class="session-trainer-name">' + trainerName + '</div>' +
               sessionNameHtml +
               '</div>';
    }

    getSessionsForDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = year + '-' + month + '-' + day;
        
        return this.sessions
            .filter(session => {
                if (this.selectedSessionType !== 'all' && session.session_type !== this.selectedSessionType) {
                    return false;
                }
                if (session.is_cancelled) {
                    return false;
                }
                let sessionDateStr = session.session_date;
                if (sessionDateStr instanceof Date) {
                    const y = sessionDateStr.getFullYear();
                    const m = String(sessionDateStr.getMonth() + 1).padStart(2, '0');
                    const d = String(sessionDateStr.getDate()).padStart(2, '0');
                    sessionDateStr = `${y}-${m}-${d}`;
                } else if (typeof sessionDateStr === 'string') {
                    sessionDateStr = sessionDateStr.split('T')[0].split(' ')[0];
                }
                return sessionDateStr === dateString;
            })
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
    }

    updateFilterButtons() {
        const buttons = document.querySelectorAll('#sessionFilters .filter-btn');
        buttons.forEach(btn => {
            const filterType = btn.getAttribute('data-type') || (btn.textContent.includes('Индивидуальные') ? 'individual' : 
                             btn.textContent.includes('Групповые') ? 'group' : 'all');
            btn.classList.toggle('active', filterType === this.selectedSessionType);
        });
    }

    static prevWeek() {
        if (window.clientMainInstance) {
            window.clientMainInstance.currentDate.setDate(window.clientMainInstance.currentDate.getDate() - 7);
            window.clientMainInstance.renderCalendar();
        }
    }

    static nextWeek() {
        if (window.clientMainInstance) {
            window.clientMainInstance.currentDate.setDate(window.clientMainInstance.currentDate.getDate() + 7);
            window.clientMainInstance.renderCalendar();
        }
    }

    static openSessionModal(scheduleId) {
        if (window.clientMainInstance) {
            window.clientMainInstance.showSessionModal(scheduleId);
        }
    }

    async showSessionModal(scheduleId) {
        const session = this.sessions.find(s => s.schedule_id === scheduleId);
        if (!session) return;

        
        let programDetails = [];
        try {
            const response = await fetch('/api/client/sessions/' + scheduleId + '/program', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                const data = await response.json();
                programDetails = data.exercises || [];
            }
        } catch (error) {
            
        }

        const sessionTypeText = session.session_type === 'individual' ? 'Индивидуальная тренировка' : 'Групповая тренировка';
        const sessionDateStr = new Date(session.session_date).toLocaleDateString('ru-RU');
        const sessionTimeStr = session.start_time.slice(0, 5) + ' - ' + session.end_time.slice(0, 5);
        const trainerNameStr = session.trainer_first_name + ' ' + session.trainer_last_name;
        const sessionNameStr = session.name || '';
        const sessionNameHtml = sessionNameStr ? '<div class="session-detail"><strong>Название:</strong> ' + sessionNameStr + '</div>' : '';
        const participantsHtml = session.session_type === 'group' 
            ? '<div class="session-detail"><strong>Участники:</strong> ' + (session.current_participants || 0) + '/' + session.max_participants + '</div>'
            : '';
        
        let programHtml = '';
        if (programDetails && programDetails.length > 0) {
            const exercisesList = programDetails.map(function(ex) {
                const duration = ex.duration_minutes ? ' (' + ex.duration_minutes + ' мин)' : '';
                return '<li>' + ex.exercise_name + duration + '</li>';
            }).join('');
            programHtml = '<div class="session-detail">' +
                '<strong>Программа тренировки:</strong>' +
                '<ul style="margin-top: 0.5rem; padding-left: 1.5rem;">' +
                exercisesList +
                '</ul>' +
                '</div>';
        }
        
        const modalHTML = '<div class="modal" id="sessionModal">' +
            '<div class="modal-content">' +
            '<span class="close" onclick="ClientMain.closeSessionModal()">&times;</span>' +
            '<h2>Детали тренировки</h2>' +
            '<div class="session-detail">' +
            '<strong>Тип:</strong> ' + sessionTypeText +
            '</div>' +
            '<div class="session-detail">' +
            '<strong>Дата и время:</strong> ' + sessionDateStr + ' ' + sessionTimeStr +
            '</div>' +
            '<div class="session-detail">' +
            '<strong>Тренер:</strong> ' + trainerNameStr +
            '</div>' +
            sessionNameHtml +
            participantsHtml +
            programHtml +
            '<div class="session-actions">' +
            '<button class="btn btn-primary" onclick="ClientMain.closeSessionModal()">Закрыть</button>' +
            '</div>' +
            '</div>' +
            '</div>';

        
        const oldModal = document.getElementById('sessionModal');
        if (oldModal) oldModal.remove();

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.body.style.overflow = 'hidden';
    }

    static closeSessionModal() {
        const modal = document.getElementById('sessionModal');
        if (modal) {
            modal.remove();
            document.body.style.overflow = 'auto';
        }
    }

    setSessionType(type, buttonElement) {
        this.selectedSessionType = type;
        this.renderCalendarDays();
        this.updateFilterButtons();
    }

    async loadTrainers() {
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const container = document.getElementById('trainers-list');
        if (!container) {
            return;
        }
        
        try {
            const response = await fetch('/api/public/trainers', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                const trainers = await response.json();
                this.renderTrainers(trainers);
            } else {
                const error = await response.json().catch(() => ({ message: 'Неизвестная ошибка' }));
                container.innerHTML = `<p style="color: red;">Ошибка загрузки тренеров: ${error.message || 'Неизвестная ошибка'}</p>`;
            }
        } catch (error) {
            if (container) {
                container.innerHTML = '<p style="color: red;">Ошибка загрузки тренеров. Проверьте подключение к серверу.</p>';
            }
        }
    }

    renderTrainers(trainers) {
        const container = document.getElementById('trainers-list');
        if (!container) return;

        if (!trainers || trainers.length === 0) {
            container.innerHTML = '<p>Информация о тренерах временно недоступна</p>';
            return;
        }

        container.innerHTML = trainers.map(trainer => `
            <div class="col">
                <div class="card trainer-card">
                    <div class="trainer-photo">
                        <img src="/images/trainers/trainer-${trainer.user_id}.jpg" 
                             alt="${trainer.first_name} ${trainer.last_name}"
                             onerror="ClientMain.handleTrainerImageError(this, ${trainer.user_id})">
                    </div>
                    <h3>${trainer.first_name} ${trainer.last_name}</h3>
                    ${trainer.specialty ? `<p class="trainer-specialty">${trainer.specialty}</p>` : ''}
                    ${trainer.experience ? `<p class="trainer-experience">Опыт: ${trainer.experience}</p>` : ''}
                    ${trainer.description ? `<p class="trainer-description">${trainer.description}</p>` : ''}
                    ${trainer.programs_count > 0 ? `<p class="trainer-programs">Программ: ${trainer.programs_count}</p>` : ''}
                </div>
            </div>
        `).join('');
    }

    async loadSubscriptionTypes() {
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const container = document.getElementById('subscriptions-list');
        if (!container) {
            return;
        }
        
        try {
            const response = await fetch('/api/client/subscription-types', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                this.subscriptionTypes = await response.json();
                this.renderSubscriptions();
            } else {
                const error = await response.json().catch(() => ({ message: 'Неизвестная ошибка' }));
                container.innerHTML = `<p style="color: red;">Ошибка загрузки абонементов: ${error.message || 'Неизвестная ошибка'}</p>`;
            }
        } catch (error) {
            if (container) {
                container.innerHTML = '<p style="color: red;">Ошибка загрузки абонементов. Проверьте подключение к серверу.</p>';
            }
        }
    }

    setCategory(category) {
        this.selectedCategory = category;
        this.renderSubscriptions();
    }

    renderSubscriptions() {
        const container = document.getElementById('subscriptions-list');
        if (!container) return;

        const filteredSubs = this.selectedCategory === 'all' 
            ? this.subscriptionTypes 
            : this.subscriptionTypes.filter(sub => sub.category === this.selectedCategory);

        if (filteredSubs.length === 0) {
            container.innerHTML = '<p>Нет доступных абонементов в выбранной категории</p>';
            return;
        }

        const gymSubs = filteredSubs.filter(s => s.category === 'gym');
        const groupSubs = filteredSubs.filter(s => s.category === 'group');
        const combinedSubs = filteredSubs.filter(s => s.category === 'combined');

        container.innerHTML = `
            ${gymSubs.length > 0 ? this.renderCategory('gym', 'Тренажерный зал', gymSubs) : ''}
            ${groupSubs.length > 0 ? this.renderCategory('group', 'Групповые тренировки', groupSubs) : ''}
            ${combinedSubs.length > 0 ? this.renderCategory('combined', 'Комбинированные', combinedSubs) : ''}
        `;
    }

    static handleTrainerImageError(img, userId) {
        const src = img.src || '';
        const base = `/images/trainers/trainer-${userId}`;

        if (src.endsWith('.jpg')) {
            img.src = `${base}.jpeg`;
        } else if (src.endsWith('.jpeg')) {
            img.src = `${base}.png`;
        } else if (src.endsWith('.png')) {
            img.src = `${base}.gif`;
        } else if (src.endsWith('.gif')) {
            img.src = `${base}.webp`;
        } else {
            img.src = '/images/trainers/default.jpg';
        }
    }

    renderCategory(category, title, subscriptions) {
        if (category === 'combined') {
            return `
                <div class="category-section">
                    <h3>${title}</h3>
                    <div class="row">
                        ${subscriptions.map(sub => this.renderSubscriptionCard(sub)).join('')}
                    </div>
                </div>
            `;
        }
        
        const fixedSubs = subscriptions.filter(sub => 
            sub.visits_count && sub.visits_count > 0
        );
        const unlimitedSubs = subscriptions.filter(sub => 
            (sub.duration_months && sub.duration_months > 0) && 
            (!sub.visits_count || sub.visits_count === 0)
        );
        
        return `
            <div class="category-section">
                <h3>${title}</h3>
                <div class="subscription-columns">
                    <div class="subscription-column">
                        <div class="row">
                            ${fixedSubs.map(sub => this.renderSubscriptionCard(sub)).join('')}
                        </div>
                    </div>
                    <div class="subscription-column">
                        <div class="row">
                            ${unlimitedSubs.map(sub => this.renderSubscriptionCard(sub)).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderSubscriptionCard(subscription) {
        const duration = subscription.duration_months 
            ? `${subscription.duration_months} мес` 
            : `${subscription.visits_count} посещений`;
            
        const isUnlimited = !subscription.duration_months && !subscription.visits_count;
        const durationText = isUnlimited ? 'Безлимит' : duration;
        const discount = subscription.discount_percent || 0;
        const finalPrice = subscription.final_price || subscription.base_price;

        return `
            <div class="col">
                <div class="card subscription-card">
                    <h3>${subscription.name}</h3>
                    <div class="price">
                        ${discount > 0 ? `<span class="old-price">${subscription.base_price} руб</span>` : ''}
                        <span class="current-price">${finalPrice} руб</span>
                    </div>
                    ${discount > 0 ? `<div class="discount-badge">Скидка ${discount}%</div>` : ''}
                    <div class="duration">${durationText}</div>
                    <p class="description">${subscription.description || ''}</p>
                    <div class="subscription-actions">
                        <button class="btn btn-primary" onclick="ClientMain.purchaseSubscription(${subscription.type_id})">
                            Купить сейчас
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    static purchaseSubscription(typeId) {
        if (window.clientMainInstance) {
            window.clientMainInstance.showPurchaseModal(typeId);
        }
    }

    async showPurchaseModal(typeId) {
        const type = this.subscriptionTypes.find(t => t.type_id === typeId);
        if (!type) return;

        const modal = document.getElementById('purchaseModal');
        if (!modal) return;

        document.getElementById('purchaseTypeName').textContent = type.name;
        document.getElementById('purchasePrice').textContent = (type.final_price || type.base_price) + ' руб.';
        document.getElementById('purchaseForm').dataset.typeId = typeId;

        modal.classList.remove('hidden');
    }

    static closePurchaseModal() {
        const modal = document.getElementById('purchaseModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    async purchaseSubscription() {
        const form = document.getElementById('purchaseForm');
        const typeId = parseInt(form.dataset.typeId);
        if (!typeId) return;

        try {
            const authHeaders = AuthService.getAuthHeaders();
            const headers = {
                'Content-Type': 'application/json'
            };
            Object.assign(headers, authHeaders);
            
            const response = await fetch('/api/client/subscriptions/purchase', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ type_id: typeId })
            });

            const result = await response.json();

            if (response.ok) {
                this.showMessage('Абонемент успешно приобретен!', 'success');
                ClientMain.closePurchaseModal();
                await this.loadSubscriptionTypes();
            } else {
                this.showMessage(result.message || 'Ошибка покупки абонемента', 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка покупки абонемента', 'error');
        }
    }

    async loadNotifications() {
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const container = document.getElementById('notificationsContainer');
        if (!container) {
            return;
        }
        
        try {
            const response = await fetch('/api/client/notifications', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                const notifications = await response.json();
                this.renderNotifications(notifications);
            } else {
                const error = await response.json().catch(() => ({ message: 'Неизвестная ошибка' }));
                container.innerHTML = `<p style="color: red;">Ошибка загрузки уведомлений: ${error.message || 'Неизвестная ошибка'}</p>`;
            }
        } catch (error) {
            if (container) {
                container.innerHTML = '<p style="color: red;">Ошибка загрузки уведомлений. Проверьте подключение к серверу.</p>';
            }
        }
    }

    renderNotifications(notifications) {
        const container = document.getElementById('notificationsContainer');
        if (!container) return;

        if (notifications.length === 0) {
            container.innerHTML = '<p>У вас нет уведомлений</p>';
            return;
        }

        container.innerHTML = notifications.map(function(notif) {
            const todayClass = notif.is_today ? 'notification-today' : '';
            const dateStr = new Date(notif.created_at).toLocaleString('ru-RU');
            return '<div class="notification-item ' + todayClass + '">' +
                '<div class="notification-content">' +
                '<strong>' + notif.title + '</strong>' +
                '<p>' + notif.message + '</p>' +
                '<small>' + dateStr + '</small>' +
                '</div>' +
                '</div>';
        }).join('');
    }

    static getPageContent() {
        return '<section class="hero">' +
            '<div class="container">' +
            '<h1>Добро пожаловать в тренажерный зал «Сила»</h1>' +
            '<p>Новый зал в Минске с современным оборудованием, профессиональными тренерами и удобным расписанием</p>' +
            '</div>' +
            '</section>' +
            '<section class="features">' +
            '<div class="container">' +
            '<h2 class="text-center">О нас</h2>' +
            '<div class="row">' +
            '<div class="col">' +
            '<div class="card">' +
            '<h3>Современное оборудование</h3>' +
            '<p>Тренажеры последнего поколения от ведущих мировых производителей</p>' +
            '</div>' +
            '</div>' +
            '<div class="col">' +
            '<div class="card">' +
            '<h3>Профессиональные тренеры</h3>' +
            '<p>Опытные специалисты с индивидуальным подходом к каждому клиенту</p>' +
            '</div>' +
            '</div>' +
            '<div class="col">' +
            '<div class="card">' +
            '<h3>Гибкий график</h3>' +
            '<p>Работаем с 6:00 до 24:00 без выходных</p>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</div>' +
            '</section>' +
            '<section id="schedule" class="schedule-preview">' +
            '<div class="container">' +
            '<h2 class="text-center">Расписание занятий</h2>' +
            '<div class="schedule-controls">' +
            '<div class="session-filters" id="sessionFilters">' +
            '<button class="filter-btn active" data-type="all">Все занятия</button>' +
            '<button class="filter-btn" data-type="individual">Индивидуальные</button>' +
            '<button class="filter-btn" data-type="group">Групповые</button>' +
            '</div>' +
            '</div>' +
            '<div id="schedule-list" class="calendar-container"></div>' +
            '</div>' +
            '</section>' +
            '<section id="trainers" class="features">' +
            '<div class="container">' +
            '<h2 class="text-center">Наши тренеры</h2>' +
            '<div id="trainers-list" class="row"></div>' +
            '</div>' +
            '</section>' +
            '<section id="pricing" class="subscriptions-section">' +
            '<div class="container">' +
            '<h2 class="text-center">Абонементы</h2>' +
            '<div class="subscription-controls">' +
            '<select class="category-select" id="subscriptionCategory">' +
            '<option value="all">Все категории абонементов</option>' +
            '<option value="gym">Тренажерный зал</option>' +
            '<option value="group">Групповые тренировки</option>' +
            '<option value="combined">Комбинированные</option>' +
            '</select>' +
            '</div>' +
            '<div id="subscriptions-list" class="subscription-categories"></div>' +
            '</div>' +
            '</section>' +
            '<section class="features">' +
            '<div class="container">' +
            '<h2 class="text-center">Уведомления</h2>' +
            '<div id="notificationsContainer" class="notifications-container">' +
            '<p>Загрузка уведомлений...</p>' +
            '</div>' +
            '</div>' +
            '</section>' +
            '<div id="purchaseModal" class="modal hidden">' +
            '<div class="modal-content">' +
            '<span class="close" onclick="ClientMain.closePurchaseModal()">&times;</span>' +
            '<h2 class="text-center">Покупка абонемента</h2>' +
            '<div class="purchase-info">' +
            '<p><strong>Тип абонемента:</strong> <span id="purchaseTypeName"></span></p>' +
            '<p><strong>Цена:</strong> <span id="purchasePrice"></span></p>' +
            '</div>' +
            '<form id="purchaseForm">' +
            '<p>Вы уверены, что хотите приобрести этот абонемент?</p>' +
            '<button type="submit" class="btn btn-primary" style="width: 100%;">Подтвердить покупку</button>' +
            '</form>' +
            '<div id="purchaseMessage" class="message hidden"></div>' +
            '</div>' +
            '</div>';
    }
}


window.ClientMain = ClientMain;