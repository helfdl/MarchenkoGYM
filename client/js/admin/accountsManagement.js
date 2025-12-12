class AccountsManagement {
    static editingAccountId = null;

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
        await this.loadAllAccounts();
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

    async loadAllAccounts() {
        try {
            const roleFilter = document.getElementById('roleFilter')?.value || 'all';
            const response = await fetch(`/api/admin/accounts?role=${roleFilter}`, {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const accounts = await response.json();
                this.renderAccounts(accounts);
            }
        } catch (error) {
            
        }
    }

    renderAccounts(accounts) {
        const container = document.getElementById('accountsList');
        if (!container) {
            return;
        }
        
        if (accounts.length === 0) {
            container.innerHTML = '<p>Нет учетных записей</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Имя</th>
                        <th>Email</th>
                        <th>Телефон</th>
                        <th>Роль</th>
                        <th>Статус</th>
                        <th>Дата</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${accounts.map(account => `
                        <tr>
                            <td>${account.first_name} ${account.last_name}</td>
                            <td>${account.email}</td>
                            <td>${account.phone || '-'}</td>
                            <td>${this.getRoleName(account.role)}</td>
                            <td>${account.is_active ? '<span class="badge badge-success">Активна</span>' : '<span class="badge badge-danger">Неактивна</span>'}</td>
                            <td>${new Date(account.created_at).toLocaleDateString()}</td>
                            <td>
                                <button class="btn btn-warning btn-sm" onclick="AccountsManagement.editAccount(${account.user_id})">
                                    Редактировать
                                </button>
                                ${account.role !== 'admin' ? `<button class="btn btn-danger btn-sm" onclick="AccountsManagement.deleteAccount(${account.user_id})">Удалить</button>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    getRoleName(role) {
        const roles = {
            'client': 'Клиент',
            'trainer': 'Тренер',
            'admin': 'Администратор'
        };
        return roles[role] || role;
    }

    setupEventListeners() {
        const searchInput = document.getElementById('accountsSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterAccounts(e.target.value);
            });
        }

        const roleFilter = document.getElementById('roleFilter');
        if (roleFilter) {
            roleFilter.addEventListener('change', () => {
                this.loadAllAccounts();
            });
        }

        const form = document.getElementById('accountForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                AccountsManagement.saveAccount();
            });
        }
    }

    filterAccounts(searchTerm) {
        const rows = document.querySelectorAll('#accountsList tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm.toLowerCase()) ? '' : 'none';
        });
    }


    static async editAccount(accountId) {
        try {
            const response = await fetch(`/api/admin/accounts/${accountId}`, {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const account = await response.json();
                const modal = document.getElementById('accountModal');
                const form = document.getElementById('accountForm');
                const title = document.getElementById('accountModalTitle');
                
                AccountsManagement.editingAccountId = accountId;
                
                document.getElementById('accountFirstName').value = account.first_name;
                document.getElementById('accountLastName').value = account.last_name;
                document.getElementById('accountEmail').value = account.email;
                document.getElementById('accountPhone').value = account.phone || '';
                
                const isActiveCheckbox = document.getElementById('accountIsActive');
                const adminNote = document.getElementById('adminNote');
                isActiveCheckbox.checked = account.is_active;
                
                if (account.role === 'admin') {
                    isActiveCheckbox.disabled = true;
                    if (adminNote) adminNote.style.display = 'inline';
                } else {
                    isActiveCheckbox.disabled = false;
                    if (adminNote) adminNote.style.display = 'none';
                }
                
                document.getElementById('accountPassword').required = false;
                
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
        } catch (error) {
            alert('Ошибка загрузки данных учетной записи');
        }
    }

    static closeAccountModal() {
        const modal = document.getElementById('accountModal');
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        document.getElementById('accountMessage').classList.add('hidden');
        document.getElementById('accountPassword').required = true;
        const isActiveCheckbox = document.getElementById('accountIsActive');
        if (isActiveCheckbox) {
            isActiveCheckbox.disabled = false;
        }
        const adminNote = document.getElementById('adminNote');
        if (adminNote) {
            adminNote.style.display = 'none';
        }
    }

    static async saveAccount() {
        const formData = {
            first_name: document.getElementById('accountFirstName').value,
            last_name: document.getElementById('accountLastName').value,
            email: document.getElementById('accountEmail').value,
            phone: document.getElementById('accountPhone').value,
            is_active: document.getElementById('accountIsActive').checked
        };

        const password = document.getElementById('accountPassword').value;
        if (password) {
            formData.password = password;
        }

        const url = `/api/admin/accounts/${AccountsManagement.editingAccountId}`;
        const method = 'PUT';

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
                alert(result.message || 'Учетная запись успешно сохранена');
                AccountsManagement.closeAccountModal();
                location.reload();
            } else {
                const messageEl = document.getElementById('accountMessage');
                messageEl.textContent = result.message || 'Ошибка сохранения';
                messageEl.classList.remove('hidden');
            }
        } catch (error) {
            alert('Ошибка сохранения учетной записи');
        }
    }

    static async toggleAccountStatus(accountId, isActive) {
        const action = isActive ? 'разблокировать' : 'заблокировать';
        if (!confirm(`Вы уверены, что хотите ${action} учетную запись?`)) return;

        try {
            const response = await fetch(`/api/admin/users/${accountId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...AuthService.getAuthHeaders()
                },
                body: JSON.stringify({ is_active: isActive })
            });

            if (response.ok) {
                alert(`Учетная запись успешно ${isActive ? 'разблокирована' : 'заблокирована'}`);
                location.reload();
            } else {
                alert('Ошибка изменения статуса');
            }
        } catch (error) {
            alert('Ошибка изменения статуса');
        }
    }

    static async deleteAccount(accountId) {
        if (!confirm('Вы уверены, что хотите удалить учетную запись? Это действие нельзя отменить.')) return;

        try {
            const response = await fetch(`/api/admin/accounts/${accountId}`, {
                method: 'DELETE',
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                alert('Учетная запись успешно удалена');
                location.reload();
            } else {
                const result = await response.json();
                alert(result.message || 'Ошибка удаления');
            }
        } catch (error) {
            alert('Ошибка удаления учетной записи');
        }
    }

    static getPageContent() {
        return `
            <div class="main-content">
                <div class="container">
                    <h1>Управление учетными записями</h1>

                    <div class="card">
                        <div class="card-header">
                            <h2>Все учетные записи</h2>
                            <div class="header-actions">
                                <input type="text" id="accountsSearch" class="form-control" placeholder="Поиск по имени, email или телефону..." style="width: 300px;">
                                <select id="roleFilter" class="form-control" style="width: 200px; margin-left: 10px;">
                                    <option value="all">Все роли</option>
                                    <option value="client">Клиенты</option>
                                    <option value="trainer">Тренеры</option>
                                    <option value="admin">Администраторы</option>
                                </select>
                            </div>
                        </div>
                        <div id="accountsList">
                        </div>
                    </div>
                </div>
            </div>

            <div id="accountModal" class="modal hidden">
                <div class="modal-content">
                    <span class="close" onclick="AccountsManagement.closeAccountModal()">&times;</span>
                    <h2 class="text-center">Редактировать учетную запись</h2>

                    <form id="accountForm">
                        <div class="row">
                            <div class="col">
                                <div class="form-group">
                                    <label for="accountFirstName" class="form-label">Имя</label>
                                    <input type="text" id="accountFirstName" class="form-control" required>
                                </div>
                            </div>
                            <div class="col">
                                <div class="form-group">
                                    <label for="accountLastName" class="form-label">Фамилия</label>
                                    <input type="text" id="accountLastName" class="form-control" required>
                                </div>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="accountEmail" class="form-label">Email</label>
                            <input type="email" id="accountEmail" class="form-control" required>
                        </div>

                        <div class="form-group">
                            <label for="accountPhone" class="form-label">Телефон</label>
                            <input type="tel" id="accountPhone" class="form-control" required>
                        </div>

                        <div class="form-group">
                            <label for="accountPassword" class="form-label">Новый пароль (оставьте пустым, если не меняете)</label>
                            <input type="password" id="accountPassword" class="form-control">
                        </div>

                        <div class="form-group">
                            <label for="accountIsActive" class="form-label">
                                <input type="checkbox" id="accountIsActive"> Активна
                                <small id="adminNote" style="display: none; color: var(--text-light); margin-left: 10px;">(Администратор не может быть заблокирован)</small>
                            </label>
                        </div>

                        <button type="submit" class="btn btn-primary" style="width: 100%;">Сохранить</button>
                    </form>

                    <div id="accountMessage" class="message hidden"></div>
                </div>
            </div>
        `;
    }
}


window.AccountsManagement = AccountsManagement;

