window.openProfileModal = function() {
    const modal = document.getElementById('profileModal');
    
    if (!modal) {
        return;
    }
    
    const user = (typeof AuthService !== 'undefined' && AuthService) ? AuthService.getCurrentUser() : null;
    
    if (user) {
        const firstNameEl = document.getElementById('profileFirstName');
        const lastNameEl = document.getElementById('profileLastName');
        const emailEl = document.getElementById('profileEmail');
        const phoneEl = document.getElementById('profilePhone');
        
        if (firstNameEl) firstNameEl.value = user.first_name || '';
        if (lastNameEl) lastNameEl.value = user.last_name || '';
        if (emailEl) emailEl.value = user.email || '';
        if (phoneEl) phoneEl.value = user.phone || '';
    }
    
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
};

window.closeProfileModal = function() {
    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    
    const messageEl = document.getElementById('profileMessage');
    if (messageEl) {
        messageEl.classList.add('hidden');
    }
};

class AdminMain {
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
        await this.loadStatistics();
        this.setupEventListeners();
        this.waitForElementAndSetup();
    }
    
    waitForElementAndSetup() {
        const checkElement = () => {
            const userInfoElement = document.getElementById('userInfo');
            if (userInfoElement && !userInfoElement.onclick) {
                this.setupProfileModalButton();
            } else if (!userInfoElement) {
                setTimeout(checkElement, 50);
            }
        };
        setTimeout(checkElement, 100);
    }
    
    setupProfileModalButton() {
        const userInfoElement = document.getElementById('userInfo');
        
        if (!userInfoElement) {
            return;
        }
        
        userInfoElement.removeAttribute('onclick');
        
        const newElement = userInfoElement.cloneNode(true);
        userInfoElement.parentNode.replaceChild(newElement, userInfoElement);
        
        newElement.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (window.openProfileModal) {
                window.openProfileModal();
            }
        }, true);
        
        newElement.style.cursor = 'pointer';
    }

    async loadStatistics() {
        try {
            const response = await fetch('/api/admin/dashboard-stats', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const stats = await response.json();
                document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
                document.getElementById('activeClients').textContent = stats.activeClients || 0;
                document.getElementById('totalTrainers').textContent = stats.totalTrainers || 0;
                document.getElementById('todayVisits').textContent = stats.todayVisits || 0;
            }
        } catch (error) {
            console.error('Ошибка загрузки статистики:', error);
        }
    }

    setupEventListeners() {
        const profileForm = document.getElementById('profileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveProfile();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const modal = document.getElementById('profileModal');
                if (modal && !modal.classList.contains('hidden')) {
                    window.closeProfileModal();
                }
            }
        });
    }

    async saveProfile() {
        const user = AuthService.getCurrentUser();
        if (!user) return;

        const formData = {
            first_name: document.getElementById('profileFirstName').value,
            last_name: document.getElementById('profileLastName').value,
            email: document.getElementById('profileEmail').value,
            phone: document.getElementById('profilePhone').value
        };

        const password = document.getElementById('profilePassword').value;
        const confirmPassword = document.getElementById('profileConfirmPassword').value;

        if (password) {
            if (password !== confirmPassword) {
                this.showMessage('Пароли не совпадают', 'error');
                return;
            }
            formData.password = password;
        }

        try {
            const response = await fetch(`/api/admin/accounts/${user.user_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...AuthService.getAuthHeaders()
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok) {
                const updatedUser = { ...user, ...formData };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                this.showMessage('Профиль успешно обновлен', 'success');
                setTimeout(() => {
                    window.closeProfileModal();
                    location.reload();
                }, 1500);
            } else {
                this.showMessage(result.message || 'Ошибка обновления профиля', 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка обновления профиля', 'error');
        }
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('profileMessage');
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
        messageEl.classList.remove('hidden');

        setTimeout(() => {
            messageEl.classList.add('hidden');
        }, 5000);
    }

    async loadUserInfo() {
        const user = AuthService.getCurrentUser();
        if (user) {
            const userInfoElement = document.getElementById('userInfo');
            if (userInfoElement) {
                userInfoElement.textContent = `${user.first_name} ${user.last_name} (Администратор)`;
                if (!userInfoElement.onclick && window.openProfileModal) {
                    userInfoElement.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        window.openProfileModal();
                    };
                    userInfoElement.style.cursor = 'pointer';
                }
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdminMain();
});