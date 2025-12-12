class AdminReports {
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
        await this.loadSummaryStats();
        await this.loadSubscriptionSales();
        await this.loadSubscriptionRevenue();
        await this.loadCategoryStats();
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

    async loadSummaryStats() {
        try {
            const response = await fetch('/api/admin/reports/summary', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const stats = await response.json();
                const totalRevenueEl = document.getElementById('totalRevenue');
                const totalSubscriptionsEl = document.getElementById('totalSubscriptions');
                const activeClientsEl = document.getElementById('activeClients');
                const monthlyVisitsEl = document.getElementById('monthlyVisits');
                
                if (totalRevenueEl) totalRevenueEl.textContent = `${stats.totalRevenue || 0} руб.`;
                if (totalSubscriptionsEl) totalSubscriptionsEl.textContent = stats.totalSubscriptions || 0;
                if (activeClientsEl) activeClientsEl.textContent = stats.activeClients || 0;
                if (monthlyVisitsEl) monthlyVisitsEl.textContent = stats.monthlyVisits || 0;
            } else {
                const error = await response.json();
                
            }
        } catch (error) {
            
        }
    }

    async loadAttendanceStats() {
        const attendancePeriodEl = document.getElementById('attendancePeriod');
        const period = attendancePeriodEl?.value || 'month';
        try {
            const response = await fetch(`/api/admin/analytics/attendance?period=${period}`, {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.renderAttendanceChart(data);
            }
        } catch (error) {
            
            const attendanceChartEl = document.getElementById('attendanceChart');
            if (attendanceChartEl) {
                attendanceChartEl.innerHTML = '<p>Ошибка загрузки данных о посещаемости</p>';
            }
        }
    }

    renderAttendanceChart(data) {
        const container = document.getElementById('attendanceChart');
        if (!container) {
            return;
        }
        
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
        const revenuePeriodEl = document.getElementById('revenuePeriod');
        const period = revenuePeriodEl?.value || 'month';
        try {
            const response = await fetch(`/api/admin/analytics/revenue?period=${period}`, {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const data = await response.json();
                this.renderRevenueChart(data);
            }
        } catch (error) {
            
            const revenueChartEl = document.getElementById('revenueChart');
            if (revenueChartEl) {
                revenueChartEl.innerHTML = '<p>Ошибка загрузки данных о доходах</p>';
            }
        }
    }

    renderRevenueChart(data) {
        const container = document.getElementById('revenueChart');
        if (!container) {
            return;
        }
        
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
                const subscriptionSalesEl = document.getElementById('subscriptionSales');
                if (subscriptionSalesEl) {
                    subscriptionSalesEl.innerHTML = '<p>Нет данных о продажах абонементов</p>';
                }
            }
        } catch (error) {
            
            const subscriptionSalesEl = document.getElementById('subscriptionSales');
            if (subscriptionSalesEl) {
                subscriptionSalesEl.innerHTML = '<p>Ошибка загрузки данных о продажах</p>';
            }
        }
    }

    renderSubscriptionSales(sales) {
        const container = document.getElementById('subscriptionSales');
        if (!container) {
            return;
        }
        
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
            
            const subscriptionRevenueEl = document.getElementById('subscriptionRevenue');
            if (subscriptionRevenueEl) {
                subscriptionRevenueEl.innerHTML = '<p>Ошибка загрузки данных</p>';
            }
        }
    }

    renderSubscriptionRevenue(revenue) {
        const container = document.getElementById('subscriptionRevenue');
        if (!container) {
            return;
        }
        
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
                const trainerStatsEl = document.getElementById('trainerStats');
                if (trainerStatsEl) {
                    trainerStatsEl.innerHTML = '<p>Нет статистики по тренерам</p>';
                }
            }
        } catch (error) {
            
            const trainerStatsEl = document.getElementById('trainerStats');
            if (trainerStatsEl) {
                trainerStatsEl.innerHTML = '<p>Ошибка загрузки статистики тренеров</p>';
            }
        }
    }

    renderTrainerStats(stats) {
        const container = document.getElementById('trainerStats');
        if (!container) {
            return;
        }
        
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
            
            const categoryStatsEl = document.getElementById('categoryStats');
            if (categoryStatsEl) {
                categoryStatsEl.innerHTML = '<p>Ошибка загрузки данных</p>';
            }
        }
    }

    renderCategoryStats(stats) {
        const container = document.getElementById('categoryStats');
        if (!container) {
            return;
        }
        
        // Создаем массив всех категорий
        const allCategories = ['gym', 'group', 'combined'];
        const statsMap = {};
        stats.forEach(item => {
            statsMap[item.category] = item;
        });

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
                    ${allCategories.map(category => {
                        const item = statsMap[category] || { category, count: 0, total_revenue: 0 };
                        return `
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
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    setupEventListeners() {
        const attendancePeriod = document.getElementById('attendancePeriod');
        if (attendancePeriod) {
            
            const newAttendancePeriod = attendancePeriod.cloneNode(true);
            attendancePeriod.parentNode.replaceChild(newAttendancePeriod, attendancePeriod);
            newAttendancePeriod.addEventListener('change', () => {
                this.loadAttendanceStats();
            });
        }

        const revenuePeriod = document.getElementById('revenuePeriod');
        if (revenuePeriod) {
            
            const newRevenuePeriod = revenuePeriod.cloneNode(true);
            revenuePeriod.parentNode.replaceChild(newRevenuePeriod, revenuePeriod);
            newRevenuePeriod.addEventListener('change', () => {
                this.loadRevenueStats();
            });
        }
    }

    static getPageContent() {
        return `
            <div class="main-content">
                <div class="container">
                    <h1>Отчеты и аналитика</h1>

                    <div class="dashboard-grid">
                        <div class="card stat-card">
                            <h3>Общая выручка</h3>
                            <p class="stat-number" id="totalRevenue">0 руб.</p>
                        </div>
                        <div class="card stat-card">
                            <h3>Продано абонементов</h3>
                            <p class="stat-number" id="totalSubscriptions">0</p>
                        </div>
                        <div class="card stat-card">
                            <h3>Активных клиентов</h3>
                            <p class="stat-number" id="activeClients">0</p>
                        </div>
                        <div class="card stat-card">
                            <h3>Посещений за месяц</h3>
                            <p class="stat-number" id="monthlyVisits">0</p>
                        </div>
                    </div>

                    <div class="card mt-4" style="margin-top: 2.5rem;">
                        <div class="card-header">
                            <h2>Отчет по продажам абонементов</h2>
                        </div>
                        <div id="subscriptionSales">
                            <p>Загрузка данных о продажах...</p>
                        </div>
                    </div>

                    <div class="card mt-4" style="margin-top: 2.5rem;">
                        <div class="card-header">
                            <h2>Отчет по доходам от абонементов</h2>
                        </div>
                        <div id="subscriptionRevenue">
                            <p>Загрузка данных о доходах...</p>
                        </div>
                    </div>

                    <div class="card mt-4" style="margin-top: 2.5rem;">
                        <div class="card-header">
                            <h2>Отчет по категориям абонементов</h2>
                        </div>
                        <div id="categoryStats">
                            <p>Загрузка статистики по категориям...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}


window.Reports = AdminReports;
window.AdminReports = AdminReports;

