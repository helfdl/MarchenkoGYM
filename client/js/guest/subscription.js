class Subscription {
    constructor() {
        this.selectedCategory = 'all';
        this.subscriptions = [];
    }

    async loadSubscriptions() {
        try {
            const response = await fetch('/api/public/subscription-types');
            if (response.ok) {
                this.subscriptions = await response.json();
                this.renderSubscriptions();
            } else {
                document.getElementById('subscriptions-list').innerHTML = 
                    '<p>Информация об абонементах временно недоступна</p>';
            }
        } catch (error) {
            document.getElementById('subscriptions-list').innerHTML = 
                '<p>Ошибка загрузки абонементов</p>';
        }
    }

    setCategory(category) {
        this.selectedCategory = category;
        this.renderSubscriptions();
    }

    renderSubscriptions() {
        const container = document.getElementById('subscriptions-list');
        
        const filteredSubs = this.selectedCategory === 'all' 
            ? this.subscriptions 
            : this.subscriptions.filter(sub => sub.category === this.selectedCategory);

        const activeSubs = filteredSubs.filter(sub => sub.is_active);

        if (activeSubs.length === 0) {
            container.innerHTML = '<p>Нет доступных абонементов в выбранной категории</p>';
            return;
        }

        const gymSubs = activeSubs.filter(s => s.category === 'gym');
        const groupSubs = activeSubs.filter(s => s.category === 'group');
        const combinedSubs = activeSubs.filter(s => s.category === 'combined');

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

        return `
            <div class="col">
                <div class="card subscription-card">
                    <h3>${subscription.name}</h3>
                    <div class="price">${subscription.final_price} руб</div>
                    <div class="duration">${durationText}</div>
                    <p class="description">${subscription.description}</p>
                    <div class="subscription-actions">
                        <button class="btn btn-primary" onclick="openRegisterModal()">
                            Купить сейчас
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

const subscription = new Subscription();
const subscriptionManager = subscription;


window.Subscription = Subscription;
window.subscription = subscription;
window.subscriptionManager = subscriptionManager;




