class ClientManagement {
    static editingClientId = null;

    constructor() {
        this.checkAuth();
        this.init();
    }

    checkAuth() {
        const user = AuthService.getCurrentUser();
        if (!user || user.role !== 'admin') {
            window.location.href = '/';
            return;
        }
    }

    async init() {
        await this.loadUserInfo();
        await this.loadClients();
        await this.loadStatistics();
        this.setupEventListeners();
    }

    async loadUserInfo() {
        const user = AuthService.getCurrentUser();
        if (user) {
            const userInfoEl = document.getElementById('userInfo');
            if (userInfoEl) {
                userInfoEl.textContent = `${user.first_name} ${user.last_name} (Администратор)`;
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
            console.error('Ошибка загрузки клиентов:', error);
        }
    }

    renderClients(clients) {
        const container = document.getElementById('clientsList');
        
        if (clients.length === 0) {
            container.innerHTML = '<p>Нет зарегистрированных клиентов</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Имя</th>
                        <th>Email</th>
                        <th>Телефон</th>
                        <th>Абонементы</th>
                        <th>Посещений</th>
                        <th>Скидка</th>
                        <th>Дата регистрации</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${clients.map(client => `
                        <tr>
                            <td>${client.first_name} ${client.last_name}</td>
                            <td>${client.email}</td>
                            <td>${client.phone || '-'}</td>
                            <td>${client.active_subscriptions}</td>
                            <td>${client.total_visits || 0}</td>
                            <td>${client.discount_percent || 0}%</td>
                            <td>${new Date(client.created_at).toLocaleDateString()}</td>
                            <td>
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
                document.getElementById('totalClients').textContent = stats.totalClients || 0;
                document.getElementById('activeSubscriptions').textContent = stats.activeSubscriptions || 0;
                document.getElementById('avgVisits').textContent = stats.avgVisits || 0;
                document.getElementById('newThisMonth').textContent = stats.newThisMonth || 0;
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
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
            console.error('Ошибка:', error);
            alert('Ошибка загрузки абонементов');
        }
    }

    static closeSubscriptionsModal() {
        const modal = document.getElementById('clientSubscriptionsModal');
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

}

document.addEventListener('DOMContentLoaded', () => {
    new ClientManagement();
});

window.ClientManagement = ClientManagement;

