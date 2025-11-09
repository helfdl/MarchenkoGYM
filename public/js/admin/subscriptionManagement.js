class SubscriptionManagement {
    static editingSubscriptionId = null;

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
        await this.loadSubscriptionTypes();
        await this.loadActiveSubscriptions();
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

    async loadSubscriptionTypes() {
        try {
            const response = await fetch('/api/admin/subscription-types', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const types = await response.json();
                this.renderSubscriptionTypes(types);
            }
        } catch (error) {
            console.error('Ошибка загрузки типов абонементов:', error);
        }
    }

    renderSubscriptionTypes(types) {
        const container = document.getElementById('subscriptionsList');
        
        if (types.length === 0) {
            container.innerHTML = '<p>Нет типов абонементов</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Название</th>
                        <th>Категория</th>
                        <th>Длительность/Посещения</th>
                        <th>Базовая цена</th>
                        <th>Итоговая цена</th>
                        <th>Описание</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${types.map(type => `
                        <tr>
                            <td>${type.name}</td>
                            <td>
                                <span class="badge ${
                                    type.category === 'gym' ? 'badge-primary' : 
                                    type.category === 'group' ? 'badge-success' : 'badge-warning'
                                }">
                                    ${type.category === 'gym' ? 'Тренажерный' : 
                                      type.category === 'group' ? 'Групповые' : 'Комбинированный'}
                                </span>
                            </td>
                            <td>
                                ${type.duration_months ? `${type.duration_months} мес.` : ''}
                                ${type.visits_count ? `${type.visits_count} посещ.` : ''}
                                ${!type.duration_months && !type.visits_count ? 'Безлимит' : ''}
                            </td>
                            <td>${parseFloat(type.base_price).toFixed(2)} руб.</td>
                            <td>${parseFloat(type.final_price).toFixed(2)} руб.</td>
                            <td>${type.description || '-'}</td>
                            <td>
                                <button class="btn btn-warning btn-sm" onclick="SubscriptionManagement.editSubscription(${type.type_id})">
                                    Редактировать
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="SubscriptionManagement.deleteSubscription(${type.type_id})">
                                    Удалить
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async loadActiveSubscriptions() {
        try {
            const response = await fetch('/api/admin/active-subscriptions', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const subscriptions = await response.json();
                this.renderActiveSubscriptions(subscriptions);
            }
        } catch (error) {
            console.error('Ошибка загрузки активных абонементов:', error);
            document.getElementById('activeSubscriptionsList').innerHTML = '<p>Нет активных абонементов</p>';
        }
    }

    renderActiveSubscriptions(subscriptions) {
        const container = document.getElementById('activeSubscriptionsList');
        
        if (!subscriptions || subscriptions.length === 0) {
            container.innerHTML = '<p>Нет активных абонементов</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Клиент</th>
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
                            <td>${sub.client_name || 'Неизвестно'}</td>
                            <td>${sub.type_name}</td>
                            <td>${new Date(sub.purchase_date).toLocaleDateString()}</td>
                            <td>${new Date(sub.start_date).toLocaleDateString()}</td>
                            <td>${new Date(sub.end_date).toLocaleDateString()}</td>
                            <td>${sub.visits_remaining !== null ? sub.visits_remaining : 'Безлимит'}</td>
                            <td>${sub.is_active ? '<span class="badge badge-success">Активен</span>' : '<span class="badge badge-danger">Неактивен</span>'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    setupEventListeners() {
        const form = document.getElementById('subscriptionForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                SubscriptionManagement.saveSubscription();
            });
        }
    }

    static openAddSubscriptionModal() {
        const modal = document.getElementById('subscriptionModal');
        const form = document.getElementById('subscriptionForm');
        const title = document.getElementById('subscriptionModalTitle');
        
        SubscriptionManagement.editingSubscriptionId = null;
        title.textContent = 'Добавить абонемент';
        form.reset();
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    static async editSubscription(typeId) {
        try {
            const response = await fetch(`/api/admin/subscription-types/${typeId}`, {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const type = await response.json();
                const modal = document.getElementById('subscriptionModal');
                const form = document.getElementById('subscriptionForm');
                const title = document.getElementById('subscriptionModalTitle');
                
                SubscriptionManagement.editingSubscriptionId = typeId;
                title.textContent = 'Редактировать абонемент';
                
                document.getElementById('subscriptionName').value = type.name;
                document.getElementById('subscriptionCategory').value = type.category;
                document.getElementById('subscriptionDuration').value = type.duration_months || '';
                document.getElementById('subscriptionVisits').value = type.visits_count || '';
                document.getElementById('subscriptionBasePrice').value = type.base_price;
                document.getElementById('subscriptionFinalPrice').value = type.final_price;
                document.getElementById('subscriptionDescription').value = type.description || '';
                
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка загрузки данных абонемента');
        }
    }

    static closeSubscriptionModal() {
        const modal = document.getElementById('subscriptionModal');
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        document.getElementById('subscriptionMessage').classList.add('hidden');
    }

    static async saveSubscription() {
        const formData = {
            name: document.getElementById('subscriptionName').value,
            category: document.getElementById('subscriptionCategory').value,
            duration_months: document.getElementById('subscriptionDuration').value || null,
            visits_count: document.getElementById('subscriptionVisits').value || null,
            base_price: parseFloat(document.getElementById('subscriptionBasePrice').value),
            final_price: parseFloat(document.getElementById('subscriptionFinalPrice').value),
            description: document.getElementById('subscriptionDescription').value
        };

        const url = SubscriptionManagement.editingSubscriptionId 
            ? `/api/admin/subscription-types/${SubscriptionManagement.editingSubscriptionId}`
            : '/api/admin/subscription-types';
        const method = SubscriptionManagement.editingSubscriptionId ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    ...AuthService.getAuthHeaders()
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                alert(result.message || 'Абонемент успешно сохранен');
                SubscriptionManagement.closeSubscriptionModal();
                location.reload();
            } else {
                const messageEl = document.getElementById('subscriptionMessage');
                messageEl.textContent = result.message || 'Ошибка сохранения';
                messageEl.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка сохранения абонемента');
        }
    }

    static async deleteSubscription(typeId) {
        if (!confirm('Вы уверены, что хотите удалить этот тип абонемента? Это действие нельзя отменить.')) return;

        try {
            const response = await fetch(`/api/admin/subscription-types/${typeId}`, {
                method: 'DELETE',
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                alert('Тип абонемента успешно удален');
                location.reload();
            } else {
                const result = await response.json();
                alert(result.message || 'Ошибка удаления');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка удаления абонемента');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SubscriptionManagement();
});

window.SubscriptionManagement = SubscriptionManagement;

