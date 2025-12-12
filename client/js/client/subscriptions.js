class ClientSubscriptions {
    constructor() {
        this.checkAuth();
        this.subscriptionTypes = [];
        this.activeSubscriptions = [];
        this.selectedCategory = 'all';
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
        await this.loadActiveSubscriptions();
        this.setupEventListeners();
    }

    async loadActiveSubscriptions() {
        try {
            const response = await fetch('/api/client/subscriptions', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                this.activeSubscriptions = await response.json();
                this.renderActiveSubscriptions();
            }
        } catch (error) {
            
        }
    }

    async loadSubscriptionTypes() {
        try {
            const response = await fetch('/api/client/subscription-types', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                this.subscriptionTypes = await response.json();
                this.renderSubscriptionTypes();
            }
        } catch (error) {
            
        }
    }

    renderActiveSubscriptions() {
        const container = document.getElementById('activeSubscriptionsList');
        if (!container) return;

        if (this.activeSubscriptions.length === 0) {
            container.innerHTML = '<p>У вас нет активных абонементов</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Тип абонемента</th>
                        <th>Категория</th>
                        <th>Действует до</th>
                        <th>Осталось посещений</th>
                        <th>Статус</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.activeSubscriptions.map(sub => {
                        const endDate = new Date(sub.end_date);
                        const isExpiringSoon = (endDate - new Date()) / (1000 * 60 * 60 * 24) <= 7;
                        return `
                            <tr ${isExpiringSoon ? 'style="background-color: #fff3cd;"' : ''}>
                                <td>${sub.type_name}</td>
                                <td>${this.getCategoryName(sub.category)}</td>
                                <td>${endDate.toLocaleDateString('ru-RU')}</td>
                                <td>${sub.corrected_visits_remaining !== undefined && sub.corrected_visits_remaining !== null ? sub.corrected_visits_remaining : (sub.visits_remaining !== null ? sub.visits_remaining : 'Безлимит')}</td>
                                <td>
                                    <span class="badge badge-success">Активен</span>
                                    ${isExpiringSoon ? '<span class="badge badge-warning" style="margin-left: 0.5rem;">Скоро истекает</span>' : ''}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    renderSubscriptionTypes() {
        const container = document.getElementById('subscriptionTypesList');
        if (!container) return;

        const filteredSubs = this.selectedCategory === 'all' 
            ? this.subscriptionTypes 
            : this.subscriptionTypes.filter(sub => sub.category === this.selectedCategory);

        if (filteredSubs.length === 0) {
            container.innerHTML = '<p>Нет доступных абонементов в выбранной категории</p>';
            return;
        }

        const gymSubs = filteredSubs.filter(s => s.category === 'gym');
        const groupSubs = filteredSubs.filter(s => s.category === 'group');
        const combinedSubs = filteredSubs.filter(s => s.category === 'combined');

        container.innerHTML = `
            ${gymSubs.length > 0 ? this.renderCategory('gym', 'Тренажерный зал', gymSubs) : ''}
            ${groupSubs.length > 0 ? this.renderCategory('group', 'Групповые тренировки', groupSubs) : ''}
            ${combinedSubs.length > 0 ? this.renderCategory('combined', 'Комбинированные', combinedSubs) : ''}
        `;
    }

    renderCategory(category, title, subscriptions) {
        if (category === 'combined') {
            return `
                <div class="category-section">
                    <h3>${title}</h3>
                    <div class="row">
                        ${subscriptions.map(sub => this.renderSubscriptionCard(sub)).join('')}
                    </div>
                </div>
            `;
        }
        
        const fixedSubs = subscriptions.filter(sub => 
            sub.visits_count && sub.visits_count > 0
        );
        const unlimitedSubs = subscriptions.filter(sub => 
            (sub.duration_months && sub.duration_months > 0) && 
            (!sub.visits_count || sub.visits_count === 0)
        );
        
        return `
            <div class="category-section">
                <h3>${title}</h3>
                <div class="subscription-columns">
                    <div class="subscription-column">
                        <div class="row">
                            ${fixedSubs.map(sub => this.renderSubscriptionCard(sub)).join('')}
                        </div>
                    </div>
                    <div class="subscription-column">
                        <div class="row">
                            ${unlimitedSubs.map(sub => this.renderSubscriptionCard(sub)).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderSubscriptionCard(subscription) {
        const duration = subscription.duration_months 
            ? `${subscription.duration_months} мес` 
            : `${subscription.visits_count} посещений`;
            
        const isUnlimited = !subscription.duration_months && !subscription.visits_count;
        const durationText = isUnlimited ? 'Безлимит' : duration;
        const discount = subscription.discount_percent || 0;
        const finalPrice = subscription.final_price || subscription.base_price;

        return `
            <div class="col">
                <div class="card subscription-card">
                    <h3>${subscription.name}</h3>
                    <div class="price">
                        ${discount > 0 ? `<span class="old-price">${subscription.base_price} руб</span>` : ''}
                        <span class="current-price">${finalPrice} руб</span>
                    </div>
                    ${discount > 0 ? `<div class="discount-badge">Скидка ${discount}%</div>` : ''}
                    <div class="duration">${durationText}</div>
                    <p class="description">${subscription.description || ''}</p>
                    <div class="subscription-actions">
                        <button class="btn btn-primary" onclick="ClientSubscriptions.purchaseSubscription(${subscription.type_id})">
                            Купить сейчас
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getCategoryName(category) {
        const names = {
            'gym': 'Тренажерный зал',
            'group': 'Групповые тренировки',
            'combined': 'Комбинированный'
        };
        return names[category] || category;
    }

    static purchaseSubscription(typeId) {
        if (window.clientSubscriptionsInstance) {
            window.clientSubscriptionsInstance.showPurchaseModal(typeId);
        }
    }

    async showPurchaseModal(typeId) {
        const type = this.subscriptionTypes.find(t => t.type_id === typeId);
        if (!type) return;

        const modal = document.getElementById('purchaseModal');
        if (!modal) return;

        document.getElementById('purchaseTypeName').textContent = type.name;
        document.getElementById('purchasePrice').textContent = (type.final_price || type.base_price) + ' руб.';
        document.getElementById('purchaseForm').dataset.typeId = typeId;

        modal.classList.remove('hidden');
    }

    static closePurchaseModal() {
        const modal = document.getElementById('purchaseModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    async purchaseSubscription() {
        const form = document.getElementById('purchaseForm');
        const typeId = parseInt(form.dataset.typeId);
        if (!typeId) return;

        try {
            const response = await fetch('/api/client/subscriptions/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...AuthService.getAuthHeaders()
                },
                body: JSON.stringify({ type_id: typeId })
            });

            const result = await response.json();

            if (response.ok) {
                this.showMessage('Абонемент успешно приобретен!', 'success');
                ClientSubscriptions.closePurchaseModal();
                await this.loadActiveSubscriptions();
            } else {
                this.showMessage(result.message || 'Ошибка покупки абонемента', 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка покупки абонемента', 'error');
        }
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('purchaseMessage');
        if (messageEl) {
            messageEl.textContent = text;
            messageEl.className = `message ${type}`;
            messageEl.classList.remove('hidden');
            setTimeout(() => {
                messageEl.classList.add('hidden');
            }, 5000);
        }
    }

    setupEventListeners() {
        const form = document.getElementById('purchaseForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.purchaseSubscription();
            });
        }

        
        setTimeout(() => {
            const categorySelect = document.getElementById('subscriptionCategory');
            if (categorySelect) {
                categorySelect.addEventListener('change', (e) => {
                    this.setCategory(e.target.value);
                });
            }
        }, 100);
    }

    setCategory(category) {
        this.selectedCategory = category;
        this.renderSubscriptionTypes();
    }

    cleanup() {
        
    }

    static getPageContent() {
        return `
            <div class="main-content">
                <div class="container">
                    <h1>Абонементы</h1>

                    <div class="card">
                        <div class="card-header">
                            <h2>Мои активные абонементы</h2>
                        </div>
                        <div id="activeSubscriptionsList">
                            <p>Загрузка...</p>
                        </div>
                    </div>
                </div>
            </div>

            <div id="purchaseModal" class="modal hidden">
                <div class="modal-content">
                    <span class="close" onclick="ClientSubscriptions.closePurchaseModal()">&times;</span>
                    <h2 class="text-center">Покупка абонемента</h2>
                    
                    <div class="purchase-info">
                        <p><strong>Тип абонемента:</strong> <span id="purchaseTypeName"></span></p>
                        <p><strong>Цена:</strong> <span id="purchasePrice"></span></p>
                    </div>

                    <form id="purchaseForm">
                        <p>Вы уверены, что хотите приобрести этот абонемент?</p>
                        <button type="submit" class="btn btn-primary" style="width: 100%;">Подтвердить покупку</button>
                    </form>

                    <div id="purchaseMessage" class="message hidden"></div>
                </div>
            </div>
        `;
    }
}

window.ClientSubscriptions = ClientSubscriptions;

