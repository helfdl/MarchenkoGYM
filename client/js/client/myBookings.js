class ClientMyBookings {
    constructor() {
        this.checkAuth();
        this.bookings = [];
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

    async init() {
        await this.loadBookings();
        this.setupEventListeners();
    }

    async loadBookings() {
        try {
            const response = await fetch('/api/client/bookings', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                this.bookings = await response.json();
                this.renderBookings();
            }
        } catch (error) {
            
        }
    }

    renderBookings() {
        const container = document.getElementById('bookingsList');
        if (!container) return;

        if (this.bookings.length === 0) {
            container.innerHTML = '<p>У вас нет записей на тренировки</p>';
            return;
        }

        const upcoming = this.bookings.filter(b => {
            const date = new Date(b.session_date);
            date.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return date >= today && b.status === 'booked';
        });

        const past = this.bookings.filter(b => {
            const date = new Date(b.session_date);
            date.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return date < today || b.status !== 'booked';
        });

        let html = '';

        if (upcoming.length > 0) {
            html += '<div class="card" style="margin-bottom: 2rem;"><div class="card-header"><h2>Предстоящие тренировки</h2></div><div class="card-body">';
            html += this.renderBookingsList(upcoming, true);
            html += '</div></div>';
        }

        if (past.length > 0) {
            html += '<div class="card" style="margin-top: 2rem;"><div class="card-header"><h2>Прошедшие тренировки</h2></div><div class="card-body">';
            html += this.renderBookingsList(past, false);
            html += '</div></div>';
        }

        container.innerHTML = html;
    }

    renderBookingsList(bookings, canCancel) {
        if (bookings.length === 0) {
            return '<p>Нет записей</p>';
        }
        
        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Время</th>
                        <th>Тренер</th>
                        <th>Название</th>
                        <th>Тип</th>
                        <th>Статус</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${bookings.map(booking => {
                        const date = new Date(booking.session_date);
                        const isToday = date.toDateString() === new Date().toDateString();
                        return `
                            <tr ${isToday ? 'style="background-color: #fff3cd;"' : ''}>
                                <td>${date.toLocaleDateString('ru-RU')}</td>
                                <td>${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)}</td>
                                <td>${booking.trainer_first_name} ${booking.trainer_last_name}</td>
                                <td>${booking.name || '-'}</td>
                                <td><span class="badge ${booking.session_type === 'individual' ? 'badge-primary' : 'badge-success'}">${booking.session_type === 'individual' ? 'Индивидуальное' : 'Групповое'}</span></td>
                                <td><span class="badge ${this.getStatusBadgeClass(booking.status)}">${this.getStatusText(booking.status)}</span></td>
                                <td>
                                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                        ${canCancel && booking.status === 'booked' 
                                            ? `<button class="btn btn-secondary btn-sm" onclick="ClientMyBookings.cancelBooking(${booking.booking_id})">Отменить</button>`
                                            : ''}
                                        <button class="btn btn-primary btn-sm" onclick="ClientMyBookings.viewProgram(${booking.schedule_id})">
                                            Программа
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    getStatusBadgeClass(status) {
        const classes = {
            'booked': 'badge-primary',
            'attended': 'badge-success',
            'cancelled': 'badge-secondary',
            'no_show': 'badge-error'
        };
        return classes[status] || 'badge-secondary';
    }

    getStatusText(status) {
        const texts = {
            'booked': 'Записан',
            'attended': 'Посетил',
            'cancelled': 'Отменен',
            'no_show': 'Не пришел'
        };
        return texts[status] || status;
    }

    static cancelBooking(bookingId) {
        if (confirm('Вы уверены, что хотите отменить запись?')) {
            if (window.clientMyBookingsInstance) {
                window.clientMyBookingsInstance.cancelBooking(bookingId);
            }
        }
    }

    async cancelBooking(bookingId) {
        try {
            const response = await fetch(`/api/client/bookings/${bookingId}`, {
                method: 'DELETE',
                headers: AuthService.getAuthHeaders()
            });

            const result = await response.json();

            if (response.ok) {
                this.showMessage('Запись отменена', 'success');
                await this.loadBookings();
            } else {
                this.showMessage(result.message || 'Ошибка отмены записи', 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка отмены записи', 'error');
        }
    }

    static viewProgram(scheduleId) {
        if (window.clientMyBookingsInstance) {
            window.clientMyBookingsInstance.showProgramModal(scheduleId);
        }
    }

    async showProgramModal(scheduleId) {
        try {
            const response = await fetch(`/api/client/sessions/${scheduleId}/program`, {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                const program = await response.json();
                this.renderProgramModal(program);
            }
        } catch (error) {
            
        }
    }

    renderProgramModal(program) {
        const modal = document.getElementById('programModal');
        if (!modal) return;

        const container = document.getElementById('programDetails');
        if (!container) return;

        if (!program.exercises || program.exercises.length === 0) {
            container.innerHTML = '<p>Программа тренировки не добавлена</p>';
        } else {
            container.innerHTML = program.exercises.map((ex, index) => `
                <div class="program-exercise">
                    <strong>${index + 1}. ${ex.exercise_name}</strong>
                    ${ex.duration_minutes ? `<span>${ex.duration_minutes} мин</span>` : ''}
                </div>
            `).join('');
        }

        modal.classList.remove('hidden');
    }

    static closeProgramModal() {
        const modal = document.getElementById('programModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    showMessage(text, type) {
        
        alert(text);
    }

    setupEventListeners() {
        
    }

    cleanup() {
        
    }

    static getPageContent() {
        return `
            <div class="main-content">
                <div class="container">
                    <h1>Мои записи</h1>
                    <div id="bookingsList">
                        <p>Загрузка...</p>
                    </div>
                </div>
            </div>

            <div id="programModal" class="modal hidden">
                <div class="modal-content">
                    <span class="close" onclick="ClientMyBookings.closeProgramModal()">&times;</span>
                    <h2 class="text-center">Программа тренировки</h2>
                    <div id="programDetails">
                    </div>
                </div>
            </div>
        `;
    }
}

window.ClientMyBookings = ClientMyBookings;

