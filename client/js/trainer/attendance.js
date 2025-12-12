class TrainerAttendance {
    constructor() {
        this.checkAuth();
        this.sessions = [];
        this.selectedDate = new Date().toISOString().split('T')[0];
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

    async init() {
        await this.loadUserInfo();
        await this.loadSessions();
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

    async loadSessions() {
        try {
            
            const response = await fetch('/api/trainer/schedule', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                const allSessions = await response.json();
                
                this.sessions = allSessions.filter(s => !s.is_cancelled);
                this.renderSessions();
            }
        } catch (error) {
            
        }
    }

    renderSessions() {
        const container = document.getElementById('sessionsList');
        if (!container) {
            return;
        }

        if (this.sessions.length === 0) {
            container.innerHTML = '<p>На выбранную дату нет тренировок</p>';
            return;
        }

        
        const sortedSessions = [...this.sessions].sort((a, b) => {
            const dateA = new Date(a.session_date + 'T' + a.start_time);
            const dateB = new Date(b.session_date + 'T' + b.start_time);
            return dateA - dateB;
        });

        const now = new Date();
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Время</th>
                        <th>Название</th>
                        <th>Тип</th>
                        <th>Участников</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedSessions.map(session => {
                        const date = new Date(session.session_date);
                        const sessionDate = new Date(session.session_date);
                        const [hours, minutes] = session.end_time.split(':');
                        const sessionDateTime = new Date(sessionDate);
                        sessionDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                        const canMarkAttendance = sessionDateTime <= now;
                        
                        return `
                            <tr>
                                <td>${date.toLocaleDateString('ru-RU')}</td>
                                <td>${session.start_time.substring(0, 5)} - ${session.end_time.substring(0, 5)}</td>
                                <td>${session.name || 'Без названия'}</td>
                                <td><span class="badge ${session.session_type === 'individual' ? 'badge-primary' : 'badge-success'}">${session.session_type === 'individual' ? 'Индивидуальное' : 'Групповое'}</span></td>
                                <td>${session.session_type === 'group' 
                                    ? `${session.current_participants !== null && session.current_participants !== undefined ? session.current_participants : 0}/${session.max_participants}` 
                                    : (session.current_participants !== null && session.current_participants !== undefined ? session.current_participants : 0)}</td>
                                <td>
                                    <button class="btn btn-primary btn-sm" 
                                            onclick="TrainerAttendance.markAttendance(${session.schedule_id})"
                                            ${!canMarkAttendance ? 'disabled' : ''}>
                                        ${canMarkAttendance ? 'Отметить посещаемость' : 'Доступно после ' + session.end_time.substring(0, 5)}
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    static markAttendance(scheduleId) {
        if (window.trainerAttendanceInstance) {
            window.trainerAttendanceInstance.showAttendanceModal(scheduleId);
        }
    }

    async showAttendanceModal(scheduleId) {
        const session = this.sessions.find(s => s.schedule_id === scheduleId);
        if (!session) return;

        
        const now = new Date();
        const sessionDate = new Date(session.session_date);
        const [hours, minutes] = session.end_time.split(':');
        const sessionDateTime = new Date(sessionDate);
        sessionDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        if (sessionDateTime > now) {
            alert('Посещаемость можно отметить только после окончания тренировки');
            return;
        }

        
        let bookings = [];
        try {
            const response = await fetch(`/api/trainer/schedule/${scheduleId}/bookings`, {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                bookings = await response.json();
            }
        } catch (error) {
            
        }

        const modal = document.getElementById('attendanceModal');
        if (!modal) return;

        const date = new Date(session.session_date);
        document.getElementById('attendanceSessionDate').textContent = date.toLocaleDateString('ru-RU');
        document.getElementById('attendanceSessionTime').textContent = `${session.start_time.substring(0, 5)} - ${session.end_time.substring(0, 5)}`;
        document.getElementById('attendanceSessionType').textContent = session.session_type === 'individual' ? 'Индивидуальное' : 'Групповое';

        
        const clientsContainer = document.getElementById('attendanceClientsList');
        if (clientsContainer) {
            if (bookings.length === 0) {
                clientsContainer.innerHTML = '<p style="color: var(--text-light); margin-bottom: 1rem;">На эту тренировку нет записей. Вы можете отметить посещаемость вручную, если клиент присутствовал.</p>';
            } else {
                clientsContainer.innerHTML = bookings.map(booking => {
                    const isAttended = booking.attendance_status === 'attended';
                    return `
                        <div class="attendance-client-item" style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; margin-bottom: 0.5rem; border-bottom: 1px solid var(--border);">
                            <div class="client-info" style="flex: 1;">
                                <strong>${booking.first_name} ${booking.last_name}</strong>
                                <span style="display: block; color: var(--text-light); font-size: 0.9rem;">${booking.email}</span>
                            </div>
                            <div class="attendance-status" style="margin-left: 1rem;">
                                <input type="checkbox" 
                                       style="width: 24px; height: 24px; cursor: pointer;"
                                       ${isAttended ? 'checked' : ''} 
                                       onchange="TrainerAttendance.toggleAttendance(${booking.booking_id || null}, ${session.schedule_id}, ${booking.user_id}, this.checked)">
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        modal.dataset.scheduleId = scheduleId;
        modal.classList.remove('hidden');
    }

    static toggleAttendance(bookingId, scheduleId, userId, attended) {
        if (window.trainerAttendanceInstance) {
            window.trainerAttendanceInstance.markClientAttendance(bookingId, scheduleId, userId, attended);
        }
    }

    async markClientAttendance(bookingId, scheduleId, userId, attended) {
        try {
            const response = await fetch(`/api/trainer/attendance`, {
                method: attended ? 'POST' : 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    ...AuthService.getAuthHeaders()
                },
                body: JSON.stringify({
                    user_id: userId,
                    schedule_id: scheduleId,
                    booking_id: bookingId || null
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.showMessage(attended ? 'Посещаемость отмечена' : 'Посещаемость снята', 'success');
                
                await this.loadStatistics();
                await this.loadSessions();
                
                const modal = document.getElementById('attendanceModal');
                if (modal && !modal.classList.contains('hidden')) {
                    const scheduleId = modal.dataset.scheduleId;
                    if (scheduleId) {
                        await this.showAttendanceModal(parseInt(scheduleId));
                    }
                }
            } else {
                this.showMessage(result.message || 'Ошибка отметки посещаемости', 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка отметки посещаемости', 'error');
        }
    }

    static closeAttendanceModal() {
        const modal = document.getElementById('attendanceModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    async loadStatistics() {
        try {
            const response = await fetch('/api/trainer/attendance/stats', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                const stats = await response.json();
                this.renderStatistics(stats);
            }
        } catch (error) {
            
        }
    }

    renderStatistics(stats) {
        const container = document.getElementById('attendanceStats');
        if (!container) return;

        const toNumber = (value) => {
            if (value === null || value === undefined) return 0;
            const num = Number(value);
            return Number.isNaN(num) ? 0 : num;
        };

        const totalSessions = toNumber(stats?.total_sessions);
        const attendedSessions = toNumber(stats?.attended_sessions);
        const groupSessions = toNumber(stats?.group_sessions);
        const groupAttendance = toNumber(stats?.group_attendance);
        const individualSessions = toNumber(stats?.individual_sessions);
        const individualAttendance = toNumber(stats?.individual_attendance);

        container.innerHTML = `
            <div class="dashboard-grid">
                <div class="card stat-card">
                    <h3>Всего тренировок</h3>
                    <p class="stat-number">${totalSessions}</p>
                </div>
                <div class="card stat-card">
                    <h3>Посещений</h3>
                    <p class="stat-number">${attendedSessions}</p>
                </div>
                <div class="card stat-card">
                    <h3>Групповые тренировки</h3>
                    <p class="stat-number">${groupSessions}</p>
                    <p style="font-size: 0.9rem; color: var(--text-light); margin-top: 0.5rem;">Посещаемость: ${groupAttendance}</p>
                </div>
                <div class="card stat-card">
                    <h3>Индивидуальные тренировки</h3>
                    <p class="stat-number">${individualSessions}</p>
                    <p style="font-size: 0.9rem; color: var(--text-light); margin-top: 0.5rem;">Посещаемость: ${individualAttendance}</p>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        
        
        this.loadStatistics();
    }

    cleanup() {
        
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('attendanceMessage');
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
            <div class="main-content">
                <div class="container">
                    <h1>Посещаемость</h1>
                    
                    <div class="dashboard-grid" id="attendanceStats" style="margin-bottom: 2.5rem;">
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h2>Тренировки</h2>
                        </div>
                        <div id="sessionsList" class="card-body" style="margin-top: 0;">
                        </div>
                    </div>
                </div>
            </div>

            <div id="attendanceModal" class="modal hidden">
                <div class="modal-content" style="max-width: 900px;">
                    <span class="close" onclick="TrainerAttendance.closeAttendanceModal()">&times;</span>
                    <h2 class="text-center">Отметка посещаемости</h2>
                    
                    <div class="session-info" style="margin-bottom: 2rem; padding: 1rem; background: var(--light); border-radius: var(--radius);">
                        <p><strong>Дата:</strong> <span id="attendanceSessionDate"></span></p>
                        <p><strong>Время:</strong> <span id="attendanceSessionTime"></span></p>
                        <p><strong>Тип:</strong> <span id="attendanceSessionType"></span></p>
                    </div>

                    <h3>Клиенты</h3>
                    <div id="attendanceClientsList" class="attendance-clients-list" style="max-height: 400px; overflow-y: auto;">
                    </div>

                    <div id="attendanceMessage" class="message hidden"></div>
                </div>
            </div>
        `;
    }
}

window.TrainerAttendance = TrainerAttendance;


