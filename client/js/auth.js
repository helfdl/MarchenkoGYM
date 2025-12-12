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
            const nameRegex = /^[A-Za-zА-Яа-яЁё]+$/;
            const phoneRegex = /^[0-9+\-]+$/;

            if (!nameRegex.test(userData.firstName) || !nameRegex.test(userData.lastName)) {
                this.showMessage('Имя и фамилия должны содержать только буквы', 'error', 'registerMessage');
                return;
            }

            if (userData.phone && !phoneRegex.test(userData.phone)) {
                this.showMessage('Номер телефона может содержать только цифры, а также символы + и -', 'error', 'registerMessage');
                return;
            }

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
        if (window.router) {
            switch (role) {
                case 'admin':
                    window.router.navigate('/admin');
                    break;
                case 'trainer':
                    window.router.navigate('/trainer');
                    break;
                case 'client':
                    window.router.navigate('/client');
                    break;
                default:
                    window.router.navigate('/');
            }
        } else {
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
    }

    static showMessage(text, type, elementId) {
        const messageEl = document.getElementById(elementId);
        messageEl.textContent = text;
        messageEl.className = `message ${type}`;
        messageEl.classList.remove('hidden');

        
        if (elementId === 'registerMessage') {
            const modalContent = document.querySelector('#registerModal .modal-content');
            if (modalContent) {
                
                requestAnimationFrame(() => {
                    const contentHeight = modalContent.scrollHeight;
                    modalContent.style.minHeight = contentHeight + 'px';
                });
            }
        }

        setTimeout(() => {
            messageEl.classList.add('hidden');
            
            if (elementId === 'registerMessage') {
                const modalContent = document.querySelector('#registerModal .modal-content');
                if (modalContent) {
                    requestAnimationFrame(() => {
                        modalContent.style.minHeight = '';
                    });
                }
            }
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
        
        this.updateNavigation(null);
        
        if (window.router) {
            window.router.navigate('/');
        } else {
            window.location.href = '/';
        }
    }

    static init() {
        const user = this.checkAuth();
        if (user) {
            const currentPath = window.location.pathname;
            this.updateNavigation(user);
            
            if (currentPath === '/' || currentPath === '/index.html') {
                setTimeout(() => {
                    this.redirectByRole(user.role);
                }, 100);
                return;
            }
        }
    }

    static updateNavigation(user) {
        const nav = document.querySelector('.navbar-nav');
        const navButtons = document.querySelector('.nav-buttons');
        const navbarBrand = document.querySelector('.navbar-brand');

        if (!nav || !navButtons) {
            return;
        }

        
        if (navbarBrand) {
            if (user) {
                if (user.role === 'admin') {
                    navbarBrand.href = '/admin';
                } else if (user.role === 'trainer') {
                    navbarBrand.href = '/trainer';
                } else if (user.role === 'client') {
                    navbarBrand.href = '/client';
                } else {
                    navbarBrand.href = '/';
                }
            } else {
                navbarBrand.href = '/';
            }
        }

        if (user) {
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
                nav.innerHTML = `
                    <li class="nav-item"><a href="/client" class="nav-link">Главная</a></li>
                    <li class="nav-item"><a href="/client/subscriptions" class="nav-link">Абонементы</a></li>
                    <li class="nav-item"><a href="/client/bookings" class="nav-link">Тренировки</a></li>
                    <li class="nav-item"><a href="/client/my-bookings" class="nav-link">Мои записи</a></li>
                    <li class="nav-item"><a href="/client/statistics" class="nav-link">Статистика</a></li>
                `;
            } else if (user.role === 'trainer') {
                nav.innerHTML = `
                    <li class="nav-item"><a href="/trainer" class="nav-link">Главная</a></li>
                    <li class="nav-item"><a href="/trainer/schedule" class="nav-link">Расписание</a></li>
                    <li class="nav-item"><a href="/trainer/clients" class="nav-link">Клиенты</a></li>
                    <li class="nav-item"><a href="/trainer/attendance" class="nav-link">Посещаемость</a></li>
                `;
            } else {
                nav.innerHTML = `
                    <li class="nav-item"><a href="/" class="nav-link">Главная</a></li>
                    <li class="nav-item"><a href="#schedule" class="nav-link">Расписание</a></li>
                    <li class="nav-item"><a href="#trainers" class="nav-link">Тренеры</a></li>
                    <li class="nav-item"><a href="#pricing" class="nav-link">Абонементы</a></li>
                `;
            }

            const displayName = (user.first_name.length + user.last_name.length > 15) 
                ? `${user.first_name} (${roleText})` 
                : `${user.first_name} ${user.last_name} (${roleText})`;
            
            navButtons.innerHTML = `
            <span class="user-info" id="userInfo">${displayName}</span>
            <button class="btn btn-secondary" onclick="AuthService.logout()">Выйти</button>
        `;
            
            const userInfoElement = document.getElementById('userInfo');
            if (userInfoElement) {
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
        } else {
            nav.innerHTML = `
                <li class="nav-item"><a href="/" class="nav-link">Главная</a></li>
                <li class="nav-item"><a href="#schedule" class="nav-link">Расписание</a></li>
                <li class="nav-item"><a href="#trainers" class="nav-link">Тренеры</a></li>
                <li class="nav-item"><a href="#pricing" class="nav-link">Абонементы</a></li>
            `;
            navButtons.innerHTML = `
                <button class="btn btn-secondary" onclick="openLoginModal()">Вход</button>
                <button class="btn btn-primary" onclick="openRegisterModal()">Регистрация</button>
            `;
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

window.AuthService = AuthService;

