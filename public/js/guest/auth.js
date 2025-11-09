function openLoginModal() {
    document.getElementById('loginModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
    clearMessages();
}

function openRegisterModal() {
    document.getElementById('registerModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeRegisterModal() {
    document.getElementById('registerModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
    clearMessages();
}

function switchToRegister() {
    closeLoginModal();
    setTimeout(openRegisterModal, 300);
}

function switchToLogin() {
    closeRegisterModal();
    setTimeout(openLoginModal, 300);
}

function clearMessages() {
    document.getElementById('loginMessage').classList.add('hidden');
    document.getElementById('registerMessage').classList.add('hidden');
}

class AuthService {
    static async login(email, password) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                this.showMessage('Вход выполнен успешно!', 'success', 'loginMessage');

                setTimeout(() => {
                    closeLoginModal();
                    this.redirectByRole(data.user.role);
                }, 1500);
            } else {
                this.showMessage(data.message, 'error', 'loginMessage');
            }
        } catch (error) {
            this.showMessage('Ошибка сети', 'error', 'loginMessage');
        }
    }

    static async register(userData) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (response.ok) {
                if (data.requiresApproval) {
                    this.showMessage(data.message, 'success', 'registerMessage');
                    setTimeout(() => {
                        closeRegisterModal();
                    }, 3000);
                } else {
                    this.showMessage(data.message, 'success', 'registerMessage');
                    setTimeout(() => {
                        closeRegisterModal();
                        openLoginModal();
                    }, 2000);
                }
            } else {
                this.showMessage(data.message, 'error', 'registerMessage');
            }
        } catch (error) {
            this.showMessage('Ошибка сети', 'error', 'registerMessage');
        }
    }

    static redirectByRole(role) {
        switch (role) {
            case 'admin':
                window.location.href = '/admin';
                break;
            case 'trainer':
                window.location.href = '/trainer';
                break;
            case 'client':
                window.location.href = '/client';
                break;
            default:
                window.location.href = '/';
        }
    }

    static showMessage(text, type, elementId) {
        const messageEl = document.getElementById(elementId);
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
        messageEl.classList.remove('hidden');

        setTimeout(() => {
            messageEl.classList.add('hidden');
        }, 5000);
    }

    static checkAuth() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');

        if (!token || !user) {
            return null;
        }

        return JSON.parse(user);
    }

    static getCurrentUser() {
        return this.checkAuth();
    }

    static getAuthHeaders() {
        const token = localStorage.getItem('token');
        if (!token) {
            return {};
        }
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    static logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }

    static init() {
        const user = this.checkAuth();
        if (user) {
            const currentPath = window.location.pathname;
            if (currentPath === '/' || currentPath === '/index.html') {
                this.redirectByRole(user.role);
                return;
            }
            this.updateNavigation(user);
        }
    }

    static updateNavigation(user) {
        const nav = document.querySelector('.navbar-nav');
        const navButtons = document.querySelector('.nav-buttons');

        if (nav && navButtons && user) {
            let roleText = '';
            switch (user.role) {
                case 'admin': roleText = 'Администратор'; break;
                case 'trainer': roleText = 'Тренер'; break;
                case 'client': roleText = 'Клиент'; break;
            }

            nav.innerHTML = '';
            navButtons.innerHTML = '';

            if (user.role === 'admin') {
                nav.innerHTML = `
                <li class="nav-item"><a href="/admin" class="nav-link">Главная</a></li>
                <li class="nav-item"><a href="/admin/accounts-management" class="nav-link">Учетные записи</a></li>
                <li class="nav-item"><a href="/admin/trainer-management" class="nav-link">Тренеры</a></li>
                <li class="nav-item"><a href="/admin/clients-management" class="nav-link">Клиенты</a></li>
                <li class="nav-item"><a href="/admin/subscriptions" class="nav-link">Абонементы</a></li>
                <li class="nav-item"><a href="/admin/schedule" class="nav-link">Расписание</a></li>
                <li class="nav-item"><a href="/admin/reports" class="nav-link">Отчеты</a></li>
            `;
            } else if (user.role === 'client') {
                nav.innerHTML = `<li class="nav-item"><a href="/client" class="nav-link">Главная</a></li>`;
            } else if (user.role === 'trainer') {
                nav.innerHTML = `<li class="nav-item"><a href="/trainer" class="nav-link">Главная</a></li>`;
            }

            navButtons.innerHTML = `
            <span class="user-info" id="userInfo">${user.first_name} ${user.last_name} (${roleText})</span>
            <button class="btn btn-secondary" onclick="AuthService.logout()">Выйти</button>
        `;
            
            const userInfoElement = document.getElementById('userInfo');
            if (userInfoElement && window.openProfileModal) {
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

document.addEventListener('DOMContentLoaded', function () {
    AuthService.init();

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            AuthService.login(email, password);
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const userData = {
                firstName: document.getElementById('regFirstName').value,
                lastName: document.getElementById('regLastName').value,
                email: document.getElementById('regEmail').value,
                phone: document.getElementById('regPhone').value,
                password: document.getElementById('regPassword').value,
                role: document.getElementById('regRole').value
            };

            const confirmPassword = document.getElementById('regConfirmPassword').value;

            if (userData.password !== confirmPassword) {
                AuthService.showMessage('Пароли не совпадают', 'error', 'registerMessage');
                return;
            }

            AuthService.register(userData);
        });
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeLoginModal();
            closeRegisterModal();
        }
    });
});