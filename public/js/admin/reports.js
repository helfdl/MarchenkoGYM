class AdminReports {
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
        await this.loadSummaryStats();
        await this.loadAttendanceStats();
        await this.loadRevenueStats();
        await this.loadSubscriptionSales();
        await this.loadSubscriptionRevenue();
        await this.loadTrainerStats();
        await this.loadCategoryStats();
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

    async loadSummaryStats() {
        try {
            const response = await fetch('/api/admin/reports/summary', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const stats = await response.json();
                document.getElementById('totalRevenue').textContent = `${stats.totalRevenue || 0} руб.`;
                document.getElementById('totalSubscriptions').textContent = stats.totalSubscriptions || 0;
                document.getElementById('activeClients').textContent = stats.activeClients || 0;
                document.getElementById('monthlyVisits').textContent = stats.monthlyVisits || 0;
            } else {
                const error = await response.json();
                console.error('Ошибка загрузки общей статистики:', error.message);
            }
        } catch (error) {
            console.error('Ошибка загрузки общей статистики:', error);
        }
    }

    async loadAttendanceStats() {
        const period = document.getElementById('attendancePeriod')?.value || 'month';
        try {
            const response = await fetch(`/api/admin/analytics/attendance?period=${period}`, {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.renderAttendanceChart(data);
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики посещаемости:', error);
            document.getElementById('attendanceChart').innerHTML = '<p>Ошибка загрузки данных о посещаемости</p>';
        }
    }

    renderAttendanceChart(data) {
        const container = document.getElementById('attendanceChart');
        
        if (data.length === 0) {
            container.innerHTML = '<p>Нет данных о посещаемости за выбранный период</p>';
            return;
        }

        const maxCount = Math.max(...data.map(item => item.count));
        const totalVisits = data.reduce((sum, item) => sum + item.count, 0);
        
        const chartHtml = `
            <div class="chart-container" style="padding: 2rem; background: var(--light); border-radius: var(--radius);">
                <div class="chart-bars" style="display: flex; align-items: flex-end; justify-content: space-around; height: 300px; gap: 0.5rem;">
                    ${data.map(item => {
                        const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                        return `
                        <div class="chart-bar-container" style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%;">
                            <div class="chart-bar" style="width: 100%; background: var(--primary); border-radius: 4px 4px 0 0; min-height: 20px; height: ${height}%; transition: all 0.3s ease; cursor: pointer;" 
                                 title="${new Date(item.date).toLocaleDateString()}: ${item.count} посещений"
                                 onmouseover="this.style.opacity='0.8'" 
                                 onmouseout="this.style.opacity='1'"></div>
                            <div class="chart-value" style="margin-top: 0.5rem; font-weight: 600; color: var(--primary);">${item.count}</div>
                            <div class="chart-label" style="font-size: 0.75rem; color: var(--text-light); margin-top: 0.25rem;">${new Date(item.date).getDate()}/${new Date(item.date).getMonth() + 1}</div>
                        </div>
                    `;
                    }).join('')}
                </div>
            </div>
            <div class="chart-legend" style="margin-top: 1rem; text-align: center;">
                <strong>Посещаемость по дням</strong>
                <div class="total-count" style="margin-top: 0.5rem; color: var(--primary); font-weight: 600;">Всего посещений: ${totalVisits}</div>
            </div>
        `;

        container.innerHTML = chartHtml;
    }

    async loadRevenueStats() {
        const period = document.getElementById('revenuePeriod')?.value || 'month';
        try {
            const response = await fetch(`/api/admin/analytics/revenue?period=${period}`, {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.renderRevenueChart(data);
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики доходов:', error);
            document.getElementById('revenueChart').innerHTML = '<p>Ошибка загрузки данных о доходах</p>';
        }
    }

    renderRevenueChart(data) {
        const container = document.getElementById('revenueChart');
        
        if (data.length === 0) {
            container.innerHTML = '<p>Нет данных о доходах за выбранный период</p>';
            return;
        }

        const totalRevenue = data.reduce((sum, item) => sum + parseFloat(item.amount), 0);
        const maxAmount = Math.max(...data.map(item => parseFloat(item.amount)));

        container.innerHTML = `
            <div class="chart-container" style="padding: 2rem; background: var(--light); border-radius: var(--radius);">
                <div class="chart-bars revenue-bars" style="display: flex; align-items: flex-end; justify-content: space-around; height: 300px; gap: 0.5rem;">
                    ${data.map(item => {
                        const amount = parseFloat(item.amount);
                        const height = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;
                        return `
                        <div class="chart-bar-container" style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%;">
                            <div class="chart-bar revenue-bar" style="width: 100%; background: var(--secondary); border-radius: 4px 4px 0 0; min-height: 20px; height: ${height}%; transition: all 0.3s ease; cursor: pointer;"
                                 title="${new Date(item.date).toLocaleDateString()}: ${amount.toFixed(2)} руб."
                                 onmouseover="this.style.opacity='0.8'" 
                                 onmouseout="this.style.opacity='1'"></div>
                            <div class="chart-value" style="margin-top: 0.5rem; font-weight: 600; color: var(--secondary); font-size: 0.85rem;">${amount.toFixed(0)}</div>
                            <div class="chart-label" style="font-size: 0.75rem; color: var(--text-light); margin-top: 0.25rem;">${new Date(item.date).getDate()}/${new Date(item.date).getMonth() + 1}</div>
                        </div>
                    `;
                    }).join('')}
                </div>
            </div>
            <div class="chart-legend" style="margin-top: 1rem; text-align: center;">
                <strong>Доходы по дням</strong>
                <div class="total-revenue" style="margin-top: 0.5rem; color: var(--secondary); font-weight: 600;">Общий доход: ${totalRevenue.toFixed(2)} руб.</div>
            </div>
        `;
    }

    async loadSubscriptionSales() {
        try {
            const response = await fetch('/api/admin/analytics/subscription-sales', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const sales = await response.json();
                this.renderSubscriptionSales(sales);
            } else {
                document.getElementById('subscriptionSales').innerHTML = '<p>Нет данных о продажах абонементов</p>';
            }
        } catch (error) {
            console.error('Ошибка загрузки продаж:', error);
            document.getElementById('subscriptionSales').innerHTML = '<p>Ошибка загрузки данных о продажах</p>';
        }
    }

    renderSubscriptionSales(sales) {
        const container = document.getElementById('subscriptionSales');
        
        if (sales.length === 0) {
            container.innerHTML = '<p>Нет данных о продажах абонементов за последние 30 дней</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Тип абонемента</th>
                        <th>Категория</th>
                        <th>Продано</th>
                        <th>Общий доход</th>
                    </tr>
                </thead>
                <tbody>
                    ${sales.map(sale => `
                        <tr>
                            <td>${sale.name}</td>
                            <td>
                                <span class="badge ${
                                    sale.category === 'gym' ? 'badge-primary' : 
                                    sale.category === 'group' ? 'badge-success' : 'badge-warning'
                                }">
                                    ${sale.category === 'gym' ? 'Тренажерный' : 
                                      sale.category === 'group' ? 'Групповые' : 'Комбинированный'}
                                </span>
                            </td>
                            <td>${sale.sold_count}</td>
                            <td>${parseFloat(sale.total_revenue).toFixed(2)} руб.</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async loadSubscriptionRevenue() {
        try {
            const response = await fetch('/api/admin/reports/subscription-revenue', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const revenue = await response.json();
                this.renderSubscriptionRevenue(revenue);
            }
        } catch (error) {
            console.error('Ошибка загрузки доходов от абонементов:', error);
            document.getElementById('subscriptionRevenue').innerHTML = '<p>Ошибка загрузки данных</p>';
        }
    }

    renderSubscriptionRevenue(revenue) {
        const container = document.getElementById('subscriptionRevenue');
        
        if (!revenue || revenue.length === 0) {
            container.innerHTML = '<p>Нет данных о доходах от абонементов</p>';
            return;
        }

        const total = revenue.reduce((sum, item) => sum + parseFloat(item.revenue || 0), 0);

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Период</th>
                        <th>Количество продаж</th>
                        <th>Доход</th>
                    </tr>
                </thead>
                <tbody>
                    ${revenue.map(item => `
                        <tr>
                            <td>${item.period}</td>
                            <td>${item.count || 0}</td>
                            <td>${parseFloat(item.revenue || 0).toFixed(2)} руб.</td>
                        </tr>
                    `).join('')}
                    <tr class="total-row">
                        <td><strong>Итого</strong></td>
                        <td><strong>${revenue.reduce((sum, item) => sum + (item.count || 0), 0)}</strong></td>
                        <td><strong>${total.toFixed(2)} руб.</strong></td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    async loadTrainerStats() {
        try {
            const response = await fetch('/api/admin/analytics/trainer-stats', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const stats = await response.json();
                this.renderTrainerStats(stats);
            } else {
                document.getElementById('trainerStats').innerHTML = '<p>Нет статистики по тренерам</p>';
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики тренеров:', error);
            document.getElementById('trainerStats').innerHTML = '<p>Ошибка загрузки статистики тренеров</p>';
        }
    }

    renderTrainerStats(stats) {
        const container = document.getElementById('trainerStats');
        
        if (stats.length === 0) {
            container.innerHTML = '<p>Нет данных о тренерах за последние 30 дней</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Тренер</th>
                        <th>Проведено занятий</th>
                        <th>Уникальных клиентов</th>
                        <th>Всего посещений</th>
                        <th>Средняя цена занятия</th>
                    </tr>
                </thead>
                <tbody>
                    ${stats.map(stat => `
                        <tr>
                            <td>${stat.first_name} ${stat.last_name}</td>
                            <td>${stat.sessions_conducted || 0}</td>
                            <td>${stat.unique_clients || 0}</td>
                            <td>${stat.total_attendances || 0}</td>
                            <td>${stat.avg_session_price ? parseFloat(stat.avg_session_price).toFixed(2) + ' руб.' : 'Н/Д'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async loadCategoryStats() {
        try {
            const response = await fetch('/api/admin/reports/category-stats', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const stats = await response.json();
                this.renderCategoryStats(stats);
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики по категориям:', error);
            document.getElementById('categoryStats').innerHTML = '<p>Ошибка загрузки данных</p>';
        }
    }

    renderCategoryStats(stats) {
        const container = document.getElementById('categoryStats');
        
        if (!stats || stats.length === 0) {
            container.innerHTML = '<p>Нет данных по категориям абонементов</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Категория</th>
                        <th>Продано абонементов</th>
                        <th>Общий доход</th>
                        <th>Средний чек</th>
                    </tr>
                </thead>
                <tbody>
                    ${stats.map(item => `
                        <tr>
                            <td>
                                <span class="badge ${
                                    item.category === 'gym' ? 'badge-primary' : 
                                    item.category === 'group' ? 'badge-success' : 'badge-warning'
                                }">
                                    ${item.category === 'gym' ? 'Тренажерный' : 
                                      item.category === 'group' ? 'Групповые' : 'Комбинированный'}
                                </span>
                            </td>
                            <td>${item.count || 0}</td>
                            <td>${parseFloat(item.total_revenue || 0).toFixed(2)} руб.</td>
                            <td>${item.count > 0 ? (parseFloat(item.total_revenue || 0) / item.count).toFixed(2) : 0} руб.</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    setupEventListeners() {
        const attendancePeriod = document.getElementById('attendancePeriod');
        if (attendancePeriod) {
            attendancePeriod.addEventListener('change', () => {
                this.loadAttendanceStats();
            });
        }

        const revenuePeriod = document.getElementById('revenuePeriod');
        if (revenuePeriod) {
            revenuePeriod.addEventListener('change', () => {
                this.loadRevenueStats();
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdminReports();
});

