class TrainerClients {
    constructor() {
        this.checkAuth();
        this.clients = [];
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
        await this.loadClients();
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

    async loadClients() {
        try {
            const response = await fetch('/api/trainer/clients', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                this.clients = await response.json();
                this.renderClients();
            } else {
                const error = await response.json();
                const container = document.getElementById('clientsList');
                if (container) {
                    container.innerHTML = '<p class="error">Ошибка загрузки клиентов: ' + (error.message || 'Неизвестная ошибка') + '</p>';
                }
            }
        } catch (error) {
            const container = document.getElementById('clientsList');
            if (container) {
                container.innerHTML = '<p class="error">Ошибка загрузки клиентов. Проверьте подключение к серверу.</p>';
            }
        }
    }

    renderClients() {
        const container = document.getElementById('clientsList');
        if (!container) {
            return;
        }

        if (this.clients.length === 0) {
            container.innerHTML = '<p>У вас пока нет клиентов</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Имя</th>
                        <th>Email</th>
                        <th>Телефон</th>
                        <th>Записан на тренировки</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.clients.map(client => `
                        <tr>
                            <td>${client.first_name} ${client.last_name}</td>
                            <td>${client.email}</td>
                            <td>${client.phone || '-'}</td>
                            <td>
                                <span class="badge badge-primary">${client.bookings_count || 0} записей</span>
                            </td>
                            <td>
                                <button class="btn btn-secondary" onclick="TrainerClients.viewClientBookings(${client.user_id})">
                                    Посмотреть записи
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    static viewClientBookings(userId) {
        if (window.trainerClientsInstance) {
            window.trainerClientsInstance.showClientBookings(userId);
        }
    }

    async showClientBookings(userId) {
        try {
            const response = await fetch(`/api/trainer/clients/${userId}/bookings`, {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                const bookings = await response.json();
                this.renderClientBookings(userId, bookings);
            }
        } catch (error) {
            
        }
    }

    renderClientBookings(userId, bookings) {
        const client = this.clients.find(c => c.user_id === userId);
        if (!client) return;

        const modal = document.getElementById('clientBookingsModal');
        if (!modal) return;

        const container = document.getElementById('clientBookingsList');
        if (!container) return;

        document.getElementById('clientBookingsTitle').textContent = `Записи клиента: ${client.first_name} ${client.last_name}`;

        if (bookings.length === 0) {
            container.innerHTML = '<p>Клиент не записан на тренировки</p>';
        } else {
            container.innerHTML = `
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Дата</th>
                            <th>Время</th>
                            <th>Тип</th>
                            <th>Название</th>
                            <th>Статус</th>
                            <th>Участников (групповая)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bookings.map(booking => {
                            const date = new Date(booking.session_date);
                            return `
                                <tr>
                                    <td>${date.toLocaleDateString('ru-RU')}</td>
                                    <td>${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)}</td>
                                    <td>${booking.session_type === 'individual' ? 'Индивидуальное' : 'Групповое'}</td>
                                    <td>${booking.name || '-'}</td>
                                    <td>
                                        <span class="badge ${booking.status === 'booked' ? 'badge-primary' : booking.status === 'attended' ? 'badge-success' : 'badge-secondary'}">
                                            ${booking.status === 'booked' ? 'Записан' : booking.status === 'attended' ? 'Посетил' : booking.status === 'cancelled' ? 'Отменен' : 'Не пришел'}
                                        </span>
                                    </td>
                                    <td>
                                        ${booking.session_type === 'group' 
                                            ? `${booking.current_participants || 0}/${booking.max_participants}` 
                                            : '-'}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }

        modal.classList.remove('hidden');
    }

    static closeClientBookings() {
        const modal = document.getElementById('clientBookingsModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    setupEventListeners() {
        const searchInput = document.getElementById('clientSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterClients(e.target.value);
            });
        }
    }

    filterClients(searchTerm) {
        const rows = document.querySelectorAll('#clientsList tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
        });
    }

    cleanup() {
        
    }

    static getPageContent() {
        return `
            <div class="main-content">
                <div class="container">
                    <h1>Мои клиенты</h1>
                    <div class="card">
                        <div class="card-header">
                            <h2>Клиенты</h2>
                            <div class="header-actions">
                                <input type="text" id="clientSearch" class="form-control" placeholder="Поиск по имени, email или телефону..." style="width: 300px;">
                            </div>
                        </div>
                        <div id="clientsList" class="clients-container">
                        </div>
                    </div>
                </div>
            </div>

            <div id="clientBookingsModal" class="modal hidden">
                <div class="modal-content wide">
                    <span class="close" onclick="TrainerClients.closeClientBookings()">&times;</span>
                    <h2 class="text-center" id="clientBookingsTitle">Записи клиента</h2>
                    <div id="clientBookingsList">
                    </div>
                </div>
            </div>
        `;
    }
}

window.TrainerClients = TrainerClients;


