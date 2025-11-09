class TrainerManagement {
    static editingTrainerId = null;
    static approvingTrainerId = null;

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
        await this.loadPendingTrainers();
        await this.loadActiveTrainers();
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

    async loadPendingTrainers() {
        try {
            const response = await fetch('/api/admin/pending-trainers', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const trainers = await response.json();
                this.renderPendingTrainers(trainers);
            }
        } catch (error) {
            console.error('Ошибка загрузки тренеров на подтверждение:', error);
        }
    }

    renderPendingTrainers(trainers) {
        const container = document.getElementById('pendingTrainersList');
        
        if (trainers.length === 0) {
            container.innerHTML = '<p>Нет тренеров на подтверждение</p>';
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Имя</th>
                        <th>Email</th>
                        <th>Телефон</th>
                        <th>Дата регистрации</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${trainers.map(trainer => `
                        <tr>
                            <td>${trainer.first_name} ${trainer.last_name}</td>
                            <td>${trainer.email}</td>
                            <td>${trainer.phone || '-'}</td>
                            <td>${new Date(trainer.created_at).toLocaleDateString()}</td>
                            <td>
                                <button class="btn btn-primary btn-sm" onclick="TrainerManagement.openApproveModal(${trainer.user_id}, '${trainer.first_name}', '${trainer.last_name}', '${trainer.email}')">
                                    Подтвердить
                                </button>
                                <button class="btn btn-danger btn-sm" onclick="TrainerManagement.rejectTrainer(${trainer.user_id})">
                                    Отклонить
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async loadActiveTrainers() {
        try {
            const response = await fetch('/api/admin/trainers', {
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                const trainers = await response.json();
                await this.renderActiveTrainers(trainers);
            }
        } catch (error) {
            console.error('Ошибка загрузки активных тренеров:', error);
        }
    }

    async renderActiveTrainers(trainers) {
        const container = document.getElementById('trainersList');
        
        if (trainers.length === 0) {
            container.innerHTML = '<p>Нет активных тренеров</p>';
            return;
        }

        const trainersWithProfiles = await Promise.all(trainers.map(async (trainer) => {
            try {
                const profileResponse = await fetch(`/api/admin/trainers/${trainer.user_id}/profile`, {
                    headers: AuthService.getAuthHeaders()
                });
                if (profileResponse.ok) {
                    const profile = await profileResponse.json();
                    return { 
                        ...trainer, 
                        ...profile,
                        experience: profile.experience || profile.experience_years || ''
                    };
                }
            } catch (error) {
                console.error(`Ошибка загрузки профиля тренера ${trainer.user_id}:`, error);
            }
            return { 
                ...trainer, 
                experience: ''
            };
        }));

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Имя</th>
                        <th>Email</th>
                        <th>Телефон</th>
                        <th>Специализация</th>
                        <th>Опыт</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${trainersWithProfiles.map(trainer => `
                        <tr>
                            <td>${trainer.first_name} ${trainer.last_name}</td>
                            <td>${trainer.email}</td>
                            <td>${trainer.phone || '-'}</td>
                            <td>${trainer.specialty || '-'}</td>
                            <td>${trainer.experience ? (trainer.experience + ' лет') : '-'}</td>
                            <td>
                                <button class="btn btn-warning btn-sm" onclick="TrainerManagement.editTrainer(${trainer.user_id})">
                                    Редактировать
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    setupEventListeners() {
        const approveForm = document.getElementById('approveTrainerForm');
        if (approveForm) {
            approveForm.addEventListener('submit', (e) => {
                e.preventDefault();
                TrainerManagement.approveTrainer();
            });
        }

        const editForm = document.getElementById('editTrainerForm');
        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                TrainerManagement.saveTrainer();
            });
        }
    }

    static openApproveModal(trainerId, firstName, lastName, email) {
        TrainerManagement.approvingTrainerId = trainerId;
        document.getElementById('approveFirstName').textContent = firstName;
        document.getElementById('approveLastName').textContent = lastName;
        document.getElementById('approveEmail').textContent = email;
        document.getElementById('approveTrainerForm').reset();
        document.getElementById('approveTrainerModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    static closeApproveModal() {
        document.getElementById('approveTrainerModal').classList.add('hidden');
        document.body.style.overflow = 'auto';
        TrainerManagement.approvingTrainerId = null;
    }

    static async approveTrainer() {
        const specialty = document.getElementById('trainerSpecialty').value;
        const experience = document.getElementById('trainerExperience').value;
        const description = document.getElementById('trainerDescription').value;

        try {
            const response = await fetch(`/api/admin/approve-trainer/${TrainerManagement.approvingTrainerId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...AuthService.getAuthHeaders()
                },
                body: JSON.stringify({
                    specialty,
                    experience,
                    description
                })
            });

            if (response.ok) {
                alert('Тренер успешно подтвержден');
                TrainerManagement.closeApproveModal();
                location.reload();
            } else {
                const result = await response.json();
                alert(result.message || 'Ошибка подтверждения тренера');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка подтверждения тренера');
        }
    }

    static async rejectTrainer(trainerId) {
        if (!confirm('Отклонить заявку тренера? Это действие нельзя отменить.')) return;

        try {
            const response = await fetch(`/api/admin/reject-trainer/${trainerId}`, {
                method: 'DELETE',
                headers: AuthService.getAuthHeaders()
            });

            if (response.ok) {
                alert('Заявка тренера отклонена');
                location.reload();
            } else {
                const result = await response.json();
                alert(result.message || 'Ошибка отклонения тренера');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка отклонения тренера');
        }
    }

    static async editTrainer(trainerId) {
        try {
            const [userResponse, profileResponse] = await Promise.all([
                fetch(`/api/admin/accounts/${trainerId}`, {
                    headers: AuthService.getAuthHeaders()
                }),
                fetch(`/api/admin/trainers/${trainerId}/profile`, {
                    headers: AuthService.getAuthHeaders()
                })
            ]);

            if (userResponse.ok && profileResponse.ok) {
                const user = await userResponse.json();
                const profile = await profileResponse.json();

                TrainerManagement.editingTrainerId = trainerId;
                
                document.getElementById('editFirstName').value = user.first_name;
                document.getElementById('editLastName').value = user.last_name;
                document.getElementById('editEmail').value = user.email;
                document.getElementById('editPhone').value = user.phone || '';
                document.getElementById('editSpecialty').value = profile.specialty || '';
                document.getElementById('editExperience').value = profile.experience || profile.experience_years || '';
                document.getElementById('editDescription').value = profile.description || profile.bio || '';
                
                document.getElementById('editTrainerModal').classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка загрузки данных тренера');
        }
    }

    static closeEditModal() {
        document.getElementById('editTrainerModal').classList.add('hidden');
        document.body.style.overflow = 'auto';
        document.getElementById('editTrainerMessage').classList.add('hidden');
        TrainerManagement.editingTrainerId = null;
    }

    static async saveTrainer() {
        const userData = {
            first_name: document.getElementById('editFirstName').value,
            last_name: document.getElementById('editLastName').value,
            email: document.getElementById('editEmail').value,
            phone: document.getElementById('editPhone').value,
            role: 'trainer',
            is_active: true
        };

        const profileData = {
            specialty: document.getElementById('editSpecialty').value,
            experience: document.getElementById('editExperience').value,
            description: document.getElementById('editDescription').value
        };

        try {
            const [userResponse, profileResponse] = await Promise.all([
                fetch(`/api/admin/accounts/${TrainerManagement.editingTrainerId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...AuthService.getAuthHeaders()
                    },
                    body: JSON.stringify(userData)
                }),
                fetch(`/api/admin/trainers/${TrainerManagement.editingTrainerId}/profile`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...AuthService.getAuthHeaders()
                    },
                    body: JSON.stringify(profileData)
                })
            ]);

            if (userResponse.ok && profileResponse.ok) {
                alert('Тренер успешно обновлен');
                TrainerManagement.closeEditModal();
                location.reload();
            } else {
                const messageEl = document.getElementById('editTrainerMessage');
                messageEl.textContent = 'Ошибка сохранения';
                messageEl.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка сохранения тренера');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TrainerManagement();
});

window.TrainerManagement = TrainerManagement;

