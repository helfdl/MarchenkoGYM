class ClientManagement {
    static editingClientId = null;

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

    async loadClients() {
        try {
            const response = await fetch('/api/admin/clients', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const clients = await response.json();
                this.renderClients(clients);
            }
        } catch (error) {
            
        }
    }

    renderClients(clients) {
        const container = document.getElementById('clientsList');
        if (!container) {
            return;
        }
        
        if (clients.length === 0) {
            container.innerHTML = '<p>Нет зарегистрированных клиентов</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="text-align: center;">Имя</th>
                        <th style="text-align: center;">Email</th>
                        <th style="text-align: center;">Телефон</th>
                        <th style="text-align: center;">Абонементы</th>
                        <th style="text-align: center;">Посещений</th>
                        <th style="text-align: center;">Скидка</th>
                        <th style="text-align: center;">Дата регистрации</th>
                        <th style="text-align: center;">Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${clients.map(client => `
                        <tr>
                            <td style="text-align: center;">${client.first_name} ${client.last_name}</td>
                            <td style="text-align: center;">${client.email}</td>
                            <td style="text-align: center;">${client.phone || '-'}</td>
                            <td style="text-align: center;">${client.active_subscriptions}</td>
                            <td style="text-align: center;">${client.total_visits || 0}</td>
                            <td style="text-align: center;">${client.discount_percent || 0}%</td>
                            <td style="text-align: center;">${new Date(client.created_at).toLocaleDateString()}</td>
                            <td style="text-align: center;">
                                <button class="btn btn-primary btn-sm" onclick="ClientManagement.viewSubscriptions(${client.user_id})">
                                    Абонементы
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async loadStatistics() {
        try {
            const response = await fetch('/api/admin/clients/stats', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const stats = await response.json();
                const totalClientsEl = document.getElementById('totalClients');
                const activeSubscriptionsEl = document.getElementById('activeSubscriptions');
                const avgVisitsEl = document.getElementById('avgVisits');
                const newThisMonthEl = document.getElementById('newThisMonth');
                
                if (totalClientsEl) totalClientsEl.textContent = stats.totalClients || 0;
                if (activeSubscriptionsEl) activeSubscriptionsEl.textContent = stats.activeSubscriptions || 0;
                if (avgVisitsEl) avgVisitsEl.textContent = stats.avgVisits || 0;
                if (newThisMonthEl) newThisMonthEl.textContent = stats.newThisMonth || 0;
            }
        } catch (error) {
            
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


    static async viewSubscriptions(clientId) {
        try {
            const response = await fetch(`/api/admin/clients/${clientId}/subscriptions`, {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const subscriptions = await response.json();
                const modal = document.getElementById('clientSubscriptionsModal');
                const container = document.getElementById('clientSubscriptionsList');
                
                if (subscriptions.length === 0) {
                    container.innerHTML = '<p>У клиента нет абонементов</p>';
                } else {
                    container.innerHTML = `
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Тип абонемента</th>
                                    <th>Дата покупки</th>
                                    <th>Начало</th>
                                    <th>Окончание</th>
                                    <th>Осталось посещений</th>
                                    <th>Статус</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${subscriptions.map(sub => `
                                    <tr>
                                        <td>${sub.type_name}</td>
                                        <td>${new Date(sub.purchase_date).toLocaleDateString()}</td>
                                        <td>${new Date(sub.start_date).toLocaleDateString()}</td>
                                        <td>${new Date(sub.end_date).toLocaleDateString()}</td>
                                        <td>${sub.visits_remaining !== null ? sub.visits_remaining : 'Безлимит'}</td>
                                        <td>${sub.is_active ? 'Активен' : 'Неактивен'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                }
                
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
        } catch (error) {
            alert('Ошибка загрузки абонементов');
        }
    }

    static closeSubscriptionsModal() {
        const modal = document.getElementById('clientSubscriptionsModal');
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    static getPageContent() {
        return `
            <div class="main-content">
                <div class="container">
                    <h1>Управление клиентами</h1>

                    <div class="card">
                        <div class="card-header">
                            <h2>Все клиенты</h2>
                            <div class="header-actions">
                                <input type="text" id="clientSearch" class="form-control" placeholder="Поиск по имени, email или телефону..." style="width: 300px;">
                            </div>
                        </div>
                        <div id="clientsList">
                        </div>
                    </div>
                </div>
            </div>

            <div id="clientSubscriptionsModal" class="modal hidden">
                <div class="modal-content wide">
                    <span class="close" onclick="ClientManagement.closeSubscriptionsModal()">&times;</span>
                    <h2 class="text-center">Абонементы клиента</h2>
                    <div id="clientSubscriptionsList">
                    </div>
                </div>
            </div>
        `;
    }
}


window.ClientManagement = ClientManagement;

