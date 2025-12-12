class ClientStatistics {
    constructor() {
        this.checkAuth();
        this.statistics = null;
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
        await this.loadStatistics();
        this.setupEventListeners();
    }

    async loadStatistics() {
        try {
            const response = await fetch('/api/client/statistics', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                this.statistics = await response.json();
                this.renderStatistics();
            }
        } catch (error) {
            
        }
    }

    renderStatistics() {
        if (!this.statistics) return;

        const container = document.getElementById('statisticsContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="dashboard-grid">
                <div class="card stat-card">
                    <h3>Всего посещений</h3>
                    <p class="stat-number">${this.statistics.totalVisits || 0}</p>
                </div>
                <div class="card stat-card">
                    <h3>Посещений в этом месяце</h3>
                    <p class="stat-number">${this.statistics.monthVisits || 0}</p>
                </div>
                <div class="card stat-card">
                    <h3>Ваша скидка</h3>
                    <p class="stat-number">${this.statistics.discountPercent || 0}%</p>
                    <p class="stat-description">${this.getDiscountDescription(this.statistics.discountPercent)}</p>
                </div>
                <div class="card stat-card">
                    <h3>До следующей скидки</h3>
                    <p class="stat-number">${this.statistics.visitsToNextDiscount || 0}</p>
                    <p class="stat-description">посещений</p>
                </div>
            </div>

            <div class="card" style="margin-top: 2.5rem;">
                <div class="card-header">
                    <h2>Посещаемость по месяцам</h2>
                </div>
                <div id="attendanceChart" class="card-body">
                    ${this.renderAttendanceChart()}
                </div>
            </div>
        `;
    }

    renderAttendanceChart() {
        if (!this.statistics.monthlyAttendance || this.statistics.monthlyAttendance.length === 0) {
            return '<p>Нет данных о посещаемости</p>';
        }

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Месяц</th>
                        <th>Посещений</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.statistics.monthlyAttendance.map(month => `
                        <tr>
                            <td>${month.month}</td>
                            <td>${month.visits || 0}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    getDiscountDescription(discount) {
        if (discount === 0) return 'Начните тренироваться, чтобы получить скидку!';
        if (discount === 5) return 'За 10 посещений';
        if (discount === 10) return 'За 20 посещений';
        if (discount === 15) return 'За 30 посещений';
        if (discount >= 20) return 'Максимальная скидка!';
        return '';
    }

    setupEventListeners() {
        
    }

    cleanup() {
        
    }

    static getPageContent() {
        return `
            <div class="main-content">
                <div class="container">
                    <h1>Статистика</h1>
                    <div id="statisticsContainer">
                        <p>Загрузка...</p>
                    </div>
                </div>
            </div>
        `;
    }
}

window.ClientStatistics = ClientStatistics;

