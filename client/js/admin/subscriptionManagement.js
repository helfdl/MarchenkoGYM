class SubscriptionManagement {
    static editingSubscriptionId = null;

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
        await this.loadSubscriptionTypes();
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
            
        }
    }

    renderSubscriptionTypes(types) {
        const container = document.getElementById('subscriptionsList');
        if (!container) {
            return;
        }
        
        // Фильтруем только активные типы абонементов
        const activeTypes = types.filter(type => type.is_active !== false && type.is_active !== 0);
        
        if (activeTypes.length === 0) {
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
                        <th>Цена</th>
                        <th>Описание</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${activeTypes.map(type => `
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
            
            const activeSubscriptionsListEl = document.getElementById('activeSubscriptionsList');
            if (activeSubscriptionsListEl) {
                activeSubscriptionsListEl.innerHTML = '<p>Нет активных абонементов</p>';
            }
        }
    }

    renderActiveSubscriptions(subscriptions) {
        const container = document.getElementById('activeSubscriptionsList');
        if (!container) {
            return;
        }
        
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
                            <td>${sub.visits_remaining !== null && sub.visits_remaining !== undefined ? sub.visits_remaining : 'Безлимит'}</td>
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
                document.getElementById('subscriptionPrice').value = type.base_price;
                document.getElementById('subscriptionDescription').value = type.description || '';
                
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
        } catch (error) {
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
        const price = parseFloat(document.getElementById('subscriptionPrice').value);
        const formData = {
            name: document.getElementById('subscriptionName').value,
            category: document.getElementById('subscriptionCategory').value,
            duration_months: document.getElementById('subscriptionDuration').value || null,
            visits_count: document.getElementById('subscriptionVisits').value || null,
            base_price: price,
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
                const instance = window.subscriptionManagementInstance;
                if (instance) {
                    await instance.loadSubscriptionTypes();
                } else {
                    location.reload();
                }
            } else {
                const result = await response.json();
                alert(result.message || 'Ошибка удаления');
            }
        } catch (error) {
            alert('Ошибка удаления абонемента');
        }
    }

    static getPageContent() {
        return `
            <div class="main-content">
                <div class="container">
                    <h1>Управление абонементами</h1>

                    <div class="card">
                        <div class="card-header">
                            <h2>Типы абонементов</h2>
                            <button class="btn btn-primary" onclick="SubscriptionManagement.openAddSubscriptionModal()">+
                                Добавить абонемент</button>
                        </div>
                        <div id="subscriptionsList">
                            <p>Загрузка абонементов...</p>
                        </div>
                    </div>
                </div>
            </div>

            <div id="subscriptionModal" class="modal hidden">
                <div class="modal-content">
                    <span class="close" onclick="SubscriptionManagement.closeSubscriptionModal()">&times;</span>
                    <h2 class="text-center" id="subscriptionModalTitle">Добавить абонемент</h2>

                    <form id="subscriptionForm">
                        <div class="form-group">
                            <label for="subscriptionName" class="form-label">Название</label>
                            <input type="text" id="subscriptionName" class="form-control" required>
                        </div>

                        <div class="form-group">
                            <label for="subscriptionCategory" class="form-label">Категория</label>
                            <select id="subscriptionCategory" class="form-control" required>
                                <option value="">Выберите категорию</option>
                                <option value="gym">Тренажерный зал</option>
                                <option value="group">Групповые тренировки</option>
                                <option value="combined">Комбинированный</option>
                            </select>
                        </div>

                        <div class="row">
                            <div class="col">
                                <div class="form-group">
                                    <label for="subscriptionDuration" class="form-label">Длительность (мес.)</label>
                                    <input type="number" id="subscriptionDuration" class="form-control" min="0" placeholder="Пусто">
                                </div>
                            </div>
                            <div class="col">
                                <div class="form-group">
                                    <label for="subscriptionVisits" class="form-label">Посещений</label>
                                    <input type="number" id="subscriptionVisits" class="form-control" min="0" placeholder="Пусто">
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="subscriptionPrice" class="form-label">Цена (руб.)</label>
                            <input type="number" id="subscriptionPrice" class="form-control" min="0" step="0.01" required>
                        </div>

                        <div class="form-group">
                            <label for="subscriptionDescription" class="form-label">Описание</label>
                            <textarea id="subscriptionDescription" class="form-control" rows="3"></textarea>
                        </div>

                        <button type="submit" class="btn btn-primary" style="width: 100%;">Сохранить</button>
                    </form>

                    <div id="subscriptionMessage" class="message hidden"></div>
                </div>
            </div>
        `;
    }
}


window.SubscriptionManagement = SubscriptionManagement;

