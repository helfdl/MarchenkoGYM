class TrainerSchedule {
    constructor() {
        this.checkAuth();
        this.currentDate = this.getWeekStart(new Date());
        this.sessions = [];
        this.programs = [];
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

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    async init() {
        await this.loadUserInfo();
        await this.loadPrograms();
        await this.loadSchedule();
        this.setupEventListeners();
    }

    async loadUserInfo() {
        const user = AuthService.getCurrentUser();
        if (user) {
            const userInfoEl = document.getElementById('userInfo');
            if (userInfoEl) {
                userInfoEl.textContent = `${user.first_name} ${user.last_name} (Тренер)`;
            }
        }
    }

    async loadPrograms() {
        try {
            const response = await fetch('/api/trainer/programs', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                this.programs = await response.json();
            }
        } catch (error) {
            // Ошибка загрузки программ
        }
    }

    async loadSchedule() {
        try {
            const response = await fetch('/api/trainer/schedule', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                this.sessions = await response.json();
                this.renderCalendar();
            } else {
                const error = await response.json();
                const container = document.getElementById('schedule-list');
                if (container) {
                    container.innerHTML = '<p class="error">Ошибка загрузки расписания: ' + (error.message || 'Неизвестная ошибка') + '</p>';
                }
            }
        } catch (error) {
            const container = document.getElementById('schedule-list');
            if (container) {
                container.innerHTML = '<p class="error">Ошибка загрузки расписания. Проверьте подключение к серверу.</p>';
            }
        }
    }

    renderCalendar() {
        const container = document.getElementById('schedule-list');
        if (!container) {
            return;
        }
        
        const weekStart = this.getWeekStart(this.currentDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const weekRange = `${weekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} - ${weekEnd.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`;

        const calendarHTML = `
            <div class="calendar">
                <div class="calendar-navigation">
                    <button class="calendar-nav-btn" onclick="TrainerSchedule.prevWeek()">← Пред неделя</button>
                    <div class="current-month">${weekRange}</div>
                    <button class="calendar-nav-btn" onclick="TrainerSchedule.nextWeek()">След неделя →</button>
                </div>
                <div class="calendar-grid" id="calendarGrid">
                    <div class="calendar-day-header">Понедельник</div>
                    <div class="calendar-day-header">Вторник</div>
                    <div class="calendar-day-header">Среда</div>
                    <div class="calendar-day-header">Четверг</div>
                    <div class="calendar-day-header">Пятница</div>
                    <div class="calendar-day-header">Суббота</div>
                    <div class="calendar-day-header">Воскресенье</div>
                </div>
            </div>
        `;

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

        // Форматируем дату в формате YYYY-MM-DD без использования toISOString (чтобы избежать проблем с часовыми поясами)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const daySessions = this.sessions.filter(s => {
            // Парсим дату сессии напрямую из строки, без создания Date объекта
            let sessionDateStr = s.session_date;
            if (sessionDateStr instanceof Date) {
                const y = sessionDateStr.getFullYear();
                const m = String(sessionDateStr.getMonth() + 1).padStart(2, '0');
                const d = String(sessionDateStr.getDate()).padStart(2, '0');
                sessionDateStr = `${y}-${m}-${d}`;
            } else if (typeof sessionDateStr === 'string') {
                // Если строка содержит время, берем только дату
                sessionDateStr = sessionDateStr.split('T')[0].split(' ')[0];
            }
            return sessionDateStr === dateStr && !s.is_cancelled;
        });

        dayElement.innerHTML = `
            <div class="day-number">${date.getDate()}</div>
            <div class="day-name">${date.toLocaleDateString('ru-RU', { weekday: 'short' })}</div>
            <div class="calendar-sessions">
                ${daySessions.map(session => `
                    <div class="session-item ${session.session_type}" 
                         onclick="TrainerSchedule.openSessionDetails(${session.schedule_id})"
                         title="${session.name || 'Тренировка'}">
                        <div class="session-time">${session.start_time.substring(0, 5)}</div>
                        ${session.name ? `<div class="session-program">${session.name}</div>` : ''}
                        ${session.session_type === 'group' ? `<div style="font-size: 0.7rem; margin-top: 0.2rem;">${session.current_participants || 0}/${session.max_participants}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        return dayElement;
    }

    static prevWeek() {
        if (window.trainerScheduleInstance) {
            const instance = window.trainerScheduleInstance;
            instance.currentDate.setDate(instance.currentDate.getDate() - 7);
            instance.renderCalendar();
        }
    }

    static nextWeek() {
        if (window.trainerScheduleInstance) {
            const instance = window.trainerScheduleInstance;
            instance.currentDate.setDate(instance.currentDate.getDate() + 7);
            instance.renderCalendar();
        }
    }

    static openSessionDetails(scheduleId) {
        if (window.trainerScheduleInstance) {
            window.trainerScheduleInstance.showSessionDetails(scheduleId);
        }
    }

    async showSessionDetails(scheduleId) {
        const session = this.sessions.find(s => s.schedule_id === scheduleId);
        if (!session) return;

        // Загружаем детали программы (упражнения) из trainer_programs
        let programDetails = [];
        if (session.program_id) {
            try {
                const program = this.programs.find(p => p.program_id === session.program_id);
                if (program && program.exercises) {
                    // exercises может быть JSON строкой или объектом
                    if (typeof program.exercises === 'string') {
                        programDetails = JSON.parse(program.exercises);
                    } else {
                        programDetails = program.exercises;
                    }
                }
            } catch (error) {
                // Ошибка загрузки упражнений
            }
        }
        
        // Также загружаем упражнения для конкретной сессии (если есть)
        try {
            const response = await fetch(`/api/trainer/schedule/${scheduleId}/exercises`, {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                const sessionExercises = await response.json();
                if (sessionExercises && sessionExercises.length > 0) {
                    programDetails = sessionExercises;
                }
            }
        } catch (error) {
            // Ошибка загрузки упражнений сессии
        }

        const modal = document.getElementById('sessionDetailsModal');
        if (!modal) return;

        const date = new Date(session.session_date);
        document.getElementById('sessionDetailsDate').textContent = date.toLocaleDateString('ru-RU');
        document.getElementById('sessionDetailsTime').textContent = `${session.start_time.substring(0, 5)} - ${session.end_time.substring(0, 5)}`;
        document.getElementById('sessionDetailsType').textContent = session.session_type === 'individual' ? 'Индивидуальное' : 'Групповое';
        document.getElementById('sessionDetailsProgram').textContent = session.name || 'Без названия';

        // Отображаем детали программы
        const detailsContainer = document.getElementById('programDetailsList');
        if (detailsContainer) {
            if (programDetails.length === 0) {
                detailsContainer.innerHTML = '<p>Детали программы не добавлены</p>';
            } else {
                // Вычисляем общую длительность упражнений
                const totalDuration = programDetails.reduce((sum, ex) => sum + (ex.duration_minutes || 0), 0);
                const sessionDuration = this.calculateSessionDuration(session.start_time, session.end_time);
                
                detailsContainer.innerHTML = `
                    <div style="margin-bottom: 1rem; padding: 0.5rem; background: #f5f5f5; border-radius: 4px;">
                        <strong>Общая длительность упражнений: ${totalDuration} мин / ${sessionDuration} мин</strong>
                    </div>
                    ${programDetails.map((detail, index) => `
                        <div class="program-detail-item">
                            <div class="detail-header">
                                <strong>${index + 1}. ${detail.exercise_name}</strong>
                                ${detail.duration_minutes ? `<span>${detail.duration_minutes} мин</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                `;
            }
        }

        // Сохраняем ID сессии для формы
        document.getElementById('sessionDetailsForm').dataset.scheduleId = scheduleId;

        modal.classList.remove('hidden');
    }

    static closeSessionDetails() {
        const modal = document.getElementById('sessionDetailsModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    setupEventListeners() {
        const form = document.getElementById('sessionDetailsForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProgramDetails();
            });
        }
    }

    calculateSessionDuration(startTime, endTime) {
        const start = new Date(`2000-01-01T${startTime}`);
        const end = new Date(`2000-01-01T${endTime}`);
        return Math.round((end - start) / (1000 * 60)); // длительность в минутах
    }

    async saveProgramDetails() {
        const form = document.getElementById('sessionDetailsForm');
        const scheduleId = parseInt(form.dataset.scheduleId);
        if (!scheduleId) return;

        const session = this.sessions.find(s => s.schedule_id === scheduleId);
        if (!session) return;

        const exerciseName = document.getElementById('exerciseName').value;
        const duration = parseInt(document.getElementById('exerciseDuration').value) || null;

        if (!exerciseName.trim()) {
            this.showMessage('Введите название упражнения', 'error');
            return;
        }

        if (!duration || duration <= 0) {
            this.showMessage('Введите длительность упражнения в минутах', 'error');
            return;
        }

        // Загружаем текущие упражнения для проверки общей длительности
        let currentExercises = [];
        try {
            const response = await fetch(`/api/trainer/schedule/${scheduleId}/exercises`, {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                currentExercises = await response.json();
            }
        } catch (error) {
            // Ошибка загрузки упражнений
        }

        // Вычисляем общую длительность всех упражнений
        const totalCurrentDuration = currentExercises.reduce((sum, ex) => sum + (ex.duration_minutes || 0), 0);
        const sessionDuration = this.calculateSessionDuration(session.start_time, session.end_time);
        const newTotalDuration = totalCurrentDuration + duration;

        if (newTotalDuration > sessionDuration) {
            this.showMessage(`Общая длительность упражнений (${newTotalDuration} мин) не может превышать длительность тренировки (${sessionDuration} мин)`, 'error');
            return;
        }

        try {
            // Сохраняем упражнение для конкретной сессии в trainer_programs
            const response = await fetch(`/api/trainer/schedule/${scheduleId}/exercises`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...AuthService.getAuthHeaders()
                },
                body: JSON.stringify({
                    program_id: session.program_id || null,
                    exercise_name: exerciseName,
                    duration_minutes: duration
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.showMessage('Упражнение добавлено', 'success');
                form.reset();
                // Обновляем детали
                this.showSessionDetails(scheduleId);
            } else {
                this.showMessage(result.message || 'Ошибка добавления упражнения', 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка добавления упражнения', 'error');
        }
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('sessionDetailsMessage');
        if (messageEl) {
            messageEl.textContent = text;
            messageEl.className = `message ${type}`;
            messageEl.classList.remove('hidden');
            setTimeout(() => {
                messageEl.classList.add('hidden');
            }, 5000);
        }
    }

    cleanup() {
        // Очистка при переходе на другую страницу
    }

    static getPageContent() {
        return `
            <div class="main-content">
                <div class="container">
                    <h1>Мое расписание</h1>
                    <div class="card">
                        <div class="card-header">
                            <h2>Расписание занятий</h2>
                        </div>
                        <div id="schedule-list" class="calendar-container" style="margin-top: 0;">
                        </div>
                    </div>
                </div>
            </div>

            <div id="sessionDetailsModal" class="modal hidden">
                <div class="modal-content" style="max-width: 750px; max-height: 90vh; overflow-y: auto;">
                    <span class="close" onclick="TrainerSchedule.closeSessionDetails()">&times;</span>
                    <h2 class="text-center">Индивидуальная программа</h2>
                    
                    <div class="session-info" style="margin-bottom: 1rem; padding: 0.75rem; background: var(--light); border-radius: var(--radius); display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                        <p style="margin: 0;"><strong>Дата:</strong> <span id="sessionDetailsDate"></span></p>
                        <p style="margin: 0;"><strong>Время:</strong> <span id="sessionDetailsTime"></span></p>
                        <p style="margin: 0;"><strong>Тип:</strong> <span id="sessionDetailsType"></span></p>
                        <p style="margin: 0;"><strong>Название:</strong> <span id="sessionDetailsProgram"></span></p>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div class="card">
                            <div class="card-header" style="margin-bottom: 0;">
                                <h3>Программа тренировки</h3>
                            </div>
                            <div id="programDetailsList" class="program-details-list" style="padding: 0.75rem; max-height: 300px; overflow-y: auto;">
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header" style="margin-bottom: 0;">
                                <h3>Добавить упражнение</h3>
                            </div>
                            <form id="sessionDetailsForm" style="padding: 0.75rem;">
                                <div class="form-group" style="margin-bottom: 0.75rem;">
                                    <label for="exerciseName" class="form-label">Название упражнения</label>
                                    <input type="text" id="exerciseName" class="form-control" required placeholder="Например: Приседания">
                                </div>
                                <div class="form-group" style="margin-bottom: 0.75rem;">
                                    <label for="exerciseDuration" class="form-label">Длительность (мин)</label>
                                    <input type="number" id="exerciseDuration" class="form-control" min="1" required placeholder="10">
                                </div>
                                <button type="submit" class="btn btn-primary" style="width: 100%;">Добавить упражнение</button>
                            </form>
                        </div>
                    </div>

                    <div id="sessionDetailsMessage" class="message hidden"></div>
                </div>
            </div>
        `;
    }
}

window.TrainerSchedule = TrainerSchedule;

