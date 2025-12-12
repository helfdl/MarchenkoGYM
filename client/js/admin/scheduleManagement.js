class ScheduleManagement {
    static editingSessionId = null;
    static instance = null;

    constructor() {
        this.checkAuth();
        this.trainers = [];
        this.programs = [];
        this.currentDate = this.getWeekStart(new Date());
        this.selectedSessionType = 'all';
        this.sessions = [];
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

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    async init() {
        await this.loadUserInfo();
        await this.loadTrainers();
        await this.loadPrograms();
        await this.loadSchedule();
        this.setupEventListeners();
        ScheduleManagement.instance = this;
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

    async loadTrainers() {
        try {
            const response = await fetch('/api/admin/trainers', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                this.trainers = await response.json();
            }
        } catch (error) {
            
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
            
            this.programs = [];
        }
    }

    async loadSchedule() {
        try {
            const response = await fetch('/api/admin/schedule', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                this.sessions = await response.json();
                this.renderCalendar();
                this.updateFilterButtons();
            }
        } catch (error) {
            
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
                    <button class="calendar-nav-btn" onclick="ScheduleManagement.prevWeek()">← Пред неделя</button>
                    <div class="current-month">${weekRange}</div>
                    <button class="calendar-nav-btn" onclick="ScheduleManagement.nextWeek()">След неделя →</button>
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
            return sessionDateStr === dateStr && 
                   (this.selectedSessionType === 'all' || s.session_type === this.selectedSessionType) &&
                   !s.is_cancelled;
        });

        dayElement.innerHTML = `
            <div class="day-number">${date.getDate()}</div>
            <div class="day-name">${date.toLocaleDateString('ru-RU', { weekday: 'short' })}</div>
            <div class="calendar-sessions">
                ${daySessions.map(session => `
                    <div class="session-item ${session.session_type}" 
                         onclick="ScheduleManagement.editSession(${session.schedule_id})"
                         title="${session.trainer_first_name} ${session.trainer_last_name} - ${session.name || 'Тренировка'}">
                        <div class="session-time">${session.start_time.substring(0, 5)}</div>
                        <div class="session-trainer-name">${session.trainer_first_name} ${session.trainer_last_name}</div>
                        ${session.name ? `<div class="session-program">${session.name}</div>` : ''}
                        ${session.session_type === 'group' ? `<div style="font-size: 0.7rem; margin-top: 0.2rem;">${session.current_bookings}/${session.max_participants}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        return dayElement;
    }

    setupEventListeners() {
        const addForm = document.getElementById('addSessionForm');
        if (addForm) {
            addForm.addEventListener('submit', (e) => {
                e.preventDefault();
                ScheduleManagement.addNewSession();
            });
        }

        const editForm = document.getElementById('editSessionForm');
        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                ScheduleManagement.updateSession();
            });
        }

        const sessionDate = document.getElementById('sessionDate');
        if (sessionDate) {
            sessionDate.min = new Date().toISOString().split('T')[0];
        }
        
        
        const sessionType = document.getElementById('sessionType');
        const maxParticipantsGroup = document.getElementById('maxParticipantsGroup');
        if (sessionType && maxParticipantsGroup) {
            sessionType.addEventListener('change', (e) => {
                if (e.target.value === 'individual') {
                    maxParticipantsGroup.style.display = 'none';
                } else {
                    maxParticipantsGroup.style.display = 'block';
                }
            });
        }
    }

    static prevWeek() {
        const instance = ScheduleManagement.instance;
        instance.currentDate.setDate(instance.currentDate.getDate() - 7);
        instance.renderCalendar();
    }

    static nextWeek() {
        const instance = ScheduleManagement.instance;
        instance.currentDate.setDate(instance.currentDate.getDate() + 7);
        instance.renderCalendar();
    }

    static setSessionType(type) {
        const instance = ScheduleManagement.instance;
        instance.selectedSessionType = type;
        instance.updateFilterButtons();
        instance.renderCalendarDays();
    }

    updateFilterButtons() {
        const buttons = document.querySelectorAll('#sessionFilters .filter-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        buttons.forEach(btn => {
            if (btn.textContent.includes('Все') && this.selectedSessionType === 'all') btn.classList.add('active');
            if (btn.textContent.includes('Индивидуальные') && this.selectedSessionType === 'individual') btn.classList.add('active');
            if (btn.textContent.includes('Групповые') && this.selectedSessionType === 'group') btn.classList.add('active');
        });
    }

    static editSession(scheduleId) {
        const instance = ScheduleManagement.instance;
        const session = instance.sessions.find(s => s.schedule_id === scheduleId);
        if (!session) return;
        
        ScheduleManagement.editingSessionId = scheduleId;
        
        const trainerSelect = document.getElementById('editSessionTrainer');
        trainerSelect.innerHTML = instance.trainers.map(t => 
            `<option value="${t.user_id}" ${t.user_id == session.trainer_id ? 'selected' : ''}>${t.first_name} ${t.last_name}</option>`
        ).join('');
        
        document.getElementById('editSessionType').value = session.session_type;
        document.getElementById('editSessionName').value = session.name || '';
        
        let sessionDateStr = session.session_date;
        
        if (sessionDateStr instanceof Date) {
            const year = sessionDateStr.getFullYear();
            const month = String(sessionDateStr.getMonth() + 1).padStart(2, '0');
            const day = String(sessionDateStr.getDate()).padStart(2, '0');
            sessionDateStr = `${year}-${month}-${day}`;
        } else if (typeof sessionDateStr === 'string') {
            
            if (sessionDateStr.includes('T')) {
                sessionDateStr = sessionDateStr.split('T')[0];
            } else if (sessionDateStr.includes(' ')) {
                sessionDateStr = sessionDateStr.split(' ')[0];
            }
        }
        document.getElementById('editSessionDate').value = sessionDateStr;
        document.getElementById('editSessionStartTime').value = session.start_time.substring(0, 5);
        document.getElementById('editSessionEndTime').value = session.end_time.substring(0, 5);
        document.getElementById('editSessionMaxParticipants').value = session.max_participants;
        
        
        const editMaxParticipantsGroup = document.getElementById('editMaxParticipantsGroup');
        if (editMaxParticipantsGroup) {
            if (session.session_type === 'individual') {
                editMaxParticipantsGroup.style.display = 'none';
            } else {
                editMaxParticipantsGroup.style.display = 'block';
            }
        }
        
        
        const editSessionType = document.getElementById('editSessionType');
        if (editSessionType) {
            
            const newEditSessionType = editSessionType.cloneNode(true);
            editSessionType.parentNode.replaceChild(newEditSessionType, editSessionType);
            
            newEditSessionType.addEventListener('change', (e) => {
                if (editMaxParticipantsGroup) {
                    if (e.target.value === 'individual') {
                        editMaxParticipantsGroup.style.display = 'none';
                    } else {
                        editMaxParticipantsGroup.style.display = 'block';
                    }
                }
            });
        }

        ScheduleManagement.openEditSessionModal();
    }

    static openEditSessionModal() {
        const modal = document.getElementById('editSessionModal');
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        document.getElementById('editSessionMessage').classList.add('hidden');
    }

    static closeEditSessionModal() {
        const modal = document.getElementById('editSessionModal');
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        document.getElementById('editSessionMessage').classList.add('hidden');
        ScheduleManagement.editingSessionId = null;
    }

    static openAddSessionModal() {
        const instance = ScheduleManagement.instance;
        
        const trainerSelect = document.getElementById('sessionTrainer');
        trainerSelect.innerHTML = '<option value="">Выберите тренера</option>' + 
            instance.trainers.map(t => 
                `<option value="${t.user_id}">${t.first_name} ${t.last_name}</option>`
            ).join('');

        

        const modal = document.getElementById('addSessionModal');
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        document.getElementById('addSessionMessage').classList.add('hidden');
    }

    static closeAddSessionModal() {
        const modal = document.getElementById('addSessionModal');
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        document.getElementById('addSessionMessage').classList.add('hidden');
    }

    static async addNewSession() {
        const sessionType = document.getElementById('sessionType').value;
        const sessionDateInput = document.getElementById('sessionDate');
        const sessionDate = sessionDateInput.value;
        const startTime = document.getElementById('sessionStartTime').value;
        const endTime = document.getElementById('sessionEndTime').value;
        
        
        const startHour = parseInt(startTime.split(':')[0]);
        const endHour = parseInt(endTime.split(':')[0]);
        if (startHour < 6 || endHour > 24 || (endHour === 24 && parseInt(endTime.split(':')[1]) > 0)) {
            const messageEl = document.getElementById('addSessionMessage');
            messageEl.textContent = 'Время работы зала: 6:00 - 24:00';
            messageEl.classList.remove('hidden');
            return;
        }
        
        
        
        const formattedDate = sessionDate;
        
        const formData = {
            trainer_id: document.getElementById('sessionTrainer').value,
            program_id: null,
            name: document.getElementById('sessionName').value || null,
            session_type: sessionType,
            session_date: formattedDate,
            start_time: startTime,
            end_time: endTime,
            max_participants: sessionType === 'group' ? document.getElementById('sessionMaxParticipants').value : 1
        };

        try {
            const response = await fetch('/api/admin/schedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...AuthService.getAuthHeaders()
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                alert('Занятие успешно добавлено');
                ScheduleManagement.closeAddSessionModal();
                location.reload();
            } else {
                const messageEl = document.getElementById('addSessionMessage');
                messageEl.textContent = result.message || 'Ошибка добавления занятия';
                messageEl.classList.remove('hidden');
            }
        } catch (error) {
            const messageEl = document.getElementById('addSessionMessage');
            messageEl.textContent = 'Ошибка добавления занятия';
            messageEl.classList.remove('hidden');
        }
    }

    static async updateSession() {
        const startTime = document.getElementById('editSessionStartTime').value;
        const endTime = document.getElementById('editSessionEndTime').value;
        
        
        const startHour = parseInt(startTime.split(':')[0]);
        const endHour = parseInt(endTime.split(':')[0]);
        if (startHour < 6 || endHour > 24 || (endHour === 24 && parseInt(endTime.split(':')[1]) > 0)) {
            const messageEl = document.getElementById('editSessionMessage');
            messageEl.textContent = 'Время работы зала: 6:00 - 24:00';
            messageEl.classList.remove('hidden');
            return;
        }
        
        const sessionDate = document.getElementById('editSessionDate').value;
        
        
        const dateParts = sessionDate.split('-');
        const formattedDate = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`;
        
        const formData = {
            trainer_id: document.getElementById('editSessionTrainer').value,
            program_id: null,
            name: document.getElementById('editSessionName').value || null,
            session_type: document.getElementById('editSessionType').value,
            session_date: formattedDate,
            start_time: startTime,
            end_time: endTime,
            max_participants: document.getElementById('editSessionMaxParticipants').value || 1
        };

        try {
            const response = await fetch(`/api/admin/schedule/${ScheduleManagement.editingSessionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...AuthService.getAuthHeaders()
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                alert('Занятие успешно обновлено');
                ScheduleManagement.closeEditSessionModal();
                location.reload();
            } else {
                const messageEl = document.getElementById('editSessionMessage');
                messageEl.textContent = result.message || 'Ошибка обновления занятия';
                messageEl.classList.remove('hidden');
            }
        } catch (error) {
            const messageEl = document.getElementById('editSessionMessage');
            messageEl.textContent = 'Ошибка обновления занятия';
            messageEl.classList.remove('hidden');
        }
    }

    static async deleteSession() {
        if (!confirm('Вы уверены, что хотите удалить это занятие? Это действие нельзя отменить.')) return;

        try {
            const response = await fetch(`/api/admin/schedule/${ScheduleManagement.editingSessionId}`, {
                method: 'DELETE',
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                alert('Занятие успешно удалено');
                ScheduleManagement.closeEditSessionModal();
                location.reload();
            } else {
                const result = await response.json();
                alert(result.message || 'Ошибка удаления');
            }
        } catch (error) {
            alert('Ошибка удаления занятия');
        }
    }

    static async cancelSession() {
        if (!confirm('Вы уверены, что хотите отменить это занятие?')) return;

        try {
            const response = await fetch(`/api/admin/schedule/${ScheduleManagement.editingSessionId}/cancel`, {
                method: 'POST',
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                alert('Занятие отменено');
                ScheduleManagement.closeEditSessionModal();
                location.reload();
            } else {
                alert('Ошибка отмены занятия');
            }
        } catch (error) {
            alert('Ошибка отмены занятия');
        }
    }

    static getPageContent() {
        return `
            <div class="main-content">
                <div class="container">
                    <h1>Управление расписанием</h1>

                    <div class="card">
                        <div class="card-header">
                            <h2>Расписание занятий</h2>
                            <div class="header-actions">
                                <div class="session-filters" id="sessionFilters">
                                    <button class="filter-btn active" onclick="ScheduleManagement.setSessionType('all')">Все занятия</button>
                                    <button class="filter-btn" onclick="ScheduleManagement.setSessionType('individual')">Индивидуальные</button>
                                    <button class="filter-btn" onclick="ScheduleManagement.setSessionType('group')">Групповые</button>
                                </div>
                                <button class="btn btn-primary" onclick="ScheduleManagement.openAddSessionModal()">+ Добавить занятие</button>
                            </div>
                        </div>
                        <div id="schedule-list" class="calendar-container" style="margin-top: 0;">
                        </div>
                    </div>
                </div>
            </div>

            <div id="addSessionModal" class="modal hidden">
                <div class="modal-content">
                    <span class="close" onclick="ScheduleManagement.closeAddSessionModal()">&times;</span>
                    <h2 class="text-center">Добавить занятие</h2>

                    <form id="addSessionForm">
                        <div class="form-group">
                            <label for="sessionTrainer" class="form-label">Тренер</label>
                            <select id="sessionTrainer" class="form-control" required>
                                <option value="">Выберите тренера</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="sessionType" class="form-label">Тип занятия</label>
                            <select id="sessionType" class="form-control" required>
                                <option value="individual">Индивидуальное</option>
                                <option value="group">Групповое</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="sessionName" class="form-label">Название</label>
                            <input type="text" id="sessionName" class="form-control" placeholder="Название тренировки">
                        </div>

                        <div class="row">
                            <div class="col">
                                <div class="form-group">
                                    <label for="sessionStartTime" class="form-label">Время начала</label>
                                    <input type="time" id="sessionStartTime" class="form-control" required min="06:00" max="24:00">
                                </div>
                            </div>
                            <div class="col">
                                <div class="form-group">
                                    <label for="sessionEndTime" class="form-label">Время окончания</label>
                                    <input type="time" id="sessionEndTime" class="form-control" required min="06:00" max="24:00">
                                </div>
                            </div>
                        </div>
                        <div class="form-group" style="margin-top: 0;">
                            <label for="sessionDate" class="form-label">Дата</label>
                            <input type="date" id="sessionDate" class="form-control" required>
                        </div>

                        <div class="form-group" id="maxParticipantsGroup" style="display: none;">
                            <label for="sessionMaxParticipants" class="form-label">Макс. участников</label>
                            <input type="number" id="sessionMaxParticipants" class="form-control" value="1" min="1">
                        </div>

                        <button type="submit" class="btn btn-primary" style="width: 100%;">Добавить занятие</button>
                    </form>

                    <div id="addSessionMessage" class="message hidden"></div>
                </div>
            </div>

            <div id="editSessionModal" class="modal hidden">
                <div class="modal-content">
                    <span class="close" onclick="ScheduleManagement.closeEditSessionModal()">&times;</span>
                    <h2 class="text-center">Редактировать занятие</h2>

                    <form id="editSessionForm">
                        <div class="form-group">
                            <label for="editSessionTrainer" class="form-label">Тренер</label>
                            <select id="editSessionTrainer" class="form-control" required>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="editSessionType" class="form-label">Тип занятия</label>
                            <select id="editSessionType" class="form-control" required>
                                <option value="individual">Индивидуальное</option>
                                <option value="group">Групповое</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="editSessionName" class="form-label">Название</label>
                            <input type="text" id="editSessionName" class="form-control" placeholder="Название тренировки">
                        </div>

                        <div class="row">
                            <div class="col">
                                <div class="form-group">
                                    <label for="editSessionStartTime" class="form-label">Время начала</label>
                                    <input type="time" id="editSessionStartTime" class="form-control" required min="06:00" max="24:00">
                                </div>
                            </div>
                            <div class="col">
                                <div class="form-group">
                                    <label for="editSessionEndTime" class="form-label">Время окончания</label>
                                    <input type="time" id="editSessionEndTime" class="form-control" required min="06:00" max="24:00">
                                </div>
                            </div>
                        </div>
                        <div class="form-group" style="margin-top: 0;">
                            <label for="editSessionDate" class="form-label">Дата</label>
                            <input type="date" id="editSessionDate" class="form-control" required>
                        </div>

                        <div class="form-group" id="editMaxParticipantsGroup">
                            <label for="editSessionMaxParticipants" class="form-label">Макс. участников (для групповых)</label>
                            <input type="number" id="editSessionMaxParticipants" class="form-control" min="1">
                        </div>

                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">Сохранить</button>
                            <button type="button" class="btn btn-danger" onclick="ScheduleManagement.deleteSession()">Удалить</button>
                        </div>
                    </form>

                    <div id="editSessionMessage" class="message hidden"></div>
                </div>
            </div>
        `;
    }
}


window.ScheduleManagement = ScheduleManagement;