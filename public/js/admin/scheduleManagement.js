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
            window.location.href = '/';
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
            document.getElementById('userInfo').textContent = `${user.first_name} ${user.last_name} (Администратор)`;
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
            console.error('Ошибка загрузки тренеров:', error);
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
            console.error('Ошибка загрузки программ:', error);
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
            console.error('Ошибка загрузки расписания:', error);
        }
    }

    renderCalendar() {
        const container = document.getElementById('schedule-list');
        
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

        const dateStr = date.toISOString().split('T')[0];
        const daySessions = this.sessions.filter(s => {
            const sessionDate = new Date(s.session_date).toISOString().split('T')[0];
            return sessionDate === dateStr && 
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
                         title="${session.trainer_first_name} ${session.trainer_last_name} - ${session.program_name || 'Тренировка'}">
                        <div class="session-time">${session.start_time.substring(0, 5)}</div>
                        <div class="session-trainer-name">${session.trainer_first_name} ${session.trainer_last_name}</div>
                        ${session.program_name ? `<div class="session-program">${session.program_name}</div>` : ''}
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
        
        const programSelect = document.getElementById('editSessionProgram');
        programSelect.innerHTML = '<option value="">Без программы</option>' + 
            instance.programs.map(p => 
                `<option value="${p.program_id}" ${p.program_id == session.program_id ? 'selected' : ''}>${p.name}</option>`
            ).join('');

        document.getElementById('editSessionType').value = session.session_type;
        document.getElementById('editSessionDate').value = new Date(session.session_date).toISOString().split('T')[0];
        document.getElementById('editSessionStartTime').value = session.start_time.substring(0, 5);
        document.getElementById('editSessionEndTime').value = session.end_time.substring(0, 5);
        document.getElementById('editSessionMaxParticipants').value = session.max_participants;

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

        const programSelect = document.getElementById('sessionProgram');
        programSelect.innerHTML = '<option value="">Без программы</option>' + 
            instance.programs.map(p => 
                `<option value="${p.program_id}">${p.name}</option>`
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
        const formData = {
            trainer_id: document.getElementById('sessionTrainer').value,
            program_id: document.getElementById('sessionProgram').value || null,
            session_type: document.getElementById('sessionType').value,
            session_date: document.getElementById('sessionDate').value,
            start_time: document.getElementById('sessionStartTime').value,
            end_time: document.getElementById('sessionEndTime').value,
            max_participants: document.getElementById('sessionMaxParticipants').value
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
            console.error('Ошибка:', error);
            const messageEl = document.getElementById('addSessionMessage');
            messageEl.textContent = 'Ошибка добавления занятия';
            messageEl.classList.remove('hidden');
        }
    }

    static async updateSession() {
        const formData = {
            trainer_id: document.getElementById('editSessionTrainer').value,
            program_id: document.getElementById('editSessionProgram').value || null,
            session_type: document.getElementById('editSessionType').value,
            session_date: document.getElementById('editSessionDate').value,
            start_time: document.getElementById('editSessionStartTime').value,
            end_time: document.getElementById('editSessionEndTime').value,
            max_participants: document.getElementById('editSessionMaxParticipants').value
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
            console.error('Ошибка:', error);
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
            console.error('Ошибка:', error);
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
            console.error('Ошибка:', error);
            alert('Ошибка отмены занятия');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ScheduleManagement();
});

window.ScheduleManagement = ScheduleManagement;