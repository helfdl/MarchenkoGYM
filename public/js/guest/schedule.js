class Schedule {
    constructor() {
        const today = new Date();
        this.currentDate = this.getWeekStart(today);
        this.selectedSessionType = 'all';
        this.sessions = [];
    }
    
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
        return new Date(d.setDate(diff));
    }

    async loadSchedule() {
        try {
            const response = await fetch('/api/public/schedule');
            if (response.ok) {
                this.sessions = await response.json();
                console.log('Загружено тренировок:', this.sessions.length);
                console.log('Пример тренировки:', this.sessions[0]);
                this.renderCalendar();
                this.updateFilterButtons();
            } else {
                document.getElementById('schedule-list').innerHTML = 
                    '<p>Расписание временно недоступно</p>';
            }
        } catch (error) {
            console.error('Ошибка загрузки расписания:', error);
            document.getElementById('schedule-list').innerHTML = 
                '<p>Ошибка загрузки расписания</p>';
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
                    <button class="calendar-nav-btn" onclick="calendar.prevWeek()">← Пред неделя</button>
                    <div class="current-month">${weekRange}</div>
                    <button class="calendar-nav-btn" onclick="calendar.nextWeek()">След неделя →</button>
                </div>
                <div class="calendar-grid" id="calendarGrid">
                    <!-- Дни недели -->
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
            calendarGrid.appendChild(this.createDayElement(date, false));
        }
    }

    createDayElement(date, isOtherMonth) {
        const dayElement = document.createElement('div');
        dayElement.className = `calendar-day ${isOtherMonth ? 'other-month' : ''}`;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateCopy = new Date(date);
        dateCopy.setHours(0, 0, 0, 0);
        
        if (dateCopy.getTime() === today.getTime()) {
            dayElement.classList.add('today');
        }

        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = date.getDate();
        
        const dayName = document.createElement('div');
        dayName.className = 'day-name';
        dayName.textContent = date.toLocaleDateString('ru-RU', { weekday: 'short' });
        
        const sessionsContainer = document.createElement('div');
        sessionsContainer.className = 'calendar-sessions';
        
        const daySessions = this.getSessionsForDate(date);
        sessionsContainer.innerHTML = daySessions.map(session => 
            this.createSessionElement(session)
        ).join('');

        dayElement.appendChild(dayNumber);
        dayElement.appendChild(dayName);
        dayElement.appendChild(sessionsContainer);
        
        return dayElement;
    }

    createSessionElement(session) {
        const sessionType = session.session_type === 'individual' ? 'individual' : 'group';
        const time = session.start_time.slice(0, 5);
        const trainerName = session.trainer_first_name ? `${session.trainer_first_name} ${session.trainer_last_name || ''}`.trim() : 'Тренер';
        
        return `
            <div class="session-item ${sessionType}" 
                 onclick="calendar.openSessionModal(${session.schedule_id})"
                 title="${trainerName} - ${session.program_name || 'Тренировка'}">
                <div class="session-time">${time}</div>
                <div class="session-trainer-name">${trainerName}</div>
                ${session.program_name ? `<div class="session-program">${session.program_name}</div>` : ''}
            </div>
        `;
    }

    getSessionsForDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;
        
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
                    sessionDateStr = sessionDateStr.toISOString().split('T')[0];
                } else if (typeof sessionDateStr === 'string') {
                    sessionDateStr = sessionDateStr.split('T')[0];
                }
                return sessionDateStr === dateString;
            })
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
    }

    updateFilterButtons() {
        const buttons = document.querySelectorAll('.filter-btn');
        buttons.forEach(btn => {
            const filterType = btn.textContent.includes('Индивидуальные') ? 'individual' : 
                             btn.textContent.includes('Групповые') ? 'group' : 'all';
            btn.classList.toggle('active', filterType === this.selectedSessionType);
        });
    }

    setSessionType(type) {
        this.selectedSessionType = type;
        this.updateFilterButtons();
        this.renderCalendarDays();
    }

    prevWeek() {
        this.currentDate.setDate(this.currentDate.getDate() - 7);
        this.renderCalendar();
    }

    nextWeek() {
        this.currentDate.setDate(this.currentDate.getDate() + 7);
        this.renderCalendar();
    }

    openSessionModal(scheduleId) {
        const session = this.sessions.find(s => s.schedule_id === scheduleId);
        if (!session) return;

        const modalHTML = `
            <div class="modal" id="sessionModal">
                <div class="modal-content">
                    <span class="close" onclick="calendar.closeSessionModal()">&times;</span>
                    <h2>Детали занятия</h2>
                    
                    <div class="session-detail">
                        <strong>Тип:</strong> ${session.session_type === 'individual' ? 'Индивидуальная тренировка' : 'Групповая тренировка'}
                    </div>
                    
                    <div class="session-detail">
                        <strong>Дата и время:</strong> 
                        ${new Date(session.session_date).toLocaleDateString('ru-RU')} 
                        ${session.start_time.slice(0, 5)} - ${session.end_time.slice(0, 5)}
                    </div>
                    
                    <div class="session-detail">
                        <strong>Тренер:</strong> ${session.trainer_first_name} ${session.trainer_last_name}
                    </div>
                    
                    ${session.program_name ? `
                    <div class="session-detail">
                        <strong>Программа:</strong> ${session.program_name}
                    </div>
                    ` : ''}
                    
                    ${session.session_type === 'group' ? `
                    <div class="session-detail">
                        <strong>Участники:</strong> ${session.current_participants}/${session.max_participants}
                    </div>
                    ` : ''}
                    
                    ${session.program_description ? `
                    <div class="session-detail">
                        <strong>Описание:</strong> ${session.program_description}
                    </div>
                    ` : ''}
                    
                    <div class="session-actions">
                        <button class="btn btn-primary" onclick="calendar.closeSessionModal()">
                            Закрыть
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.body.style.overflow = 'hidden';
    }

    closeSessionModal() {
        const modal = document.getElementById('sessionModal');
        if (modal) {
            modal.remove();
            document.body.style.overflow = 'auto';
        }
    }
}


const schedule = new Schedule();
const calendar = schedule;

document.addEventListener('DOMContentLoaded', () => {
    schedule.loadSchedule();
});