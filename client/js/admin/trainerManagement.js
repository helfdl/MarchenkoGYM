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
            
        }
    }

    renderPendingTrainers(trainers) {
        const container = document.getElementById('pendingTrainersList');
        if (!container) {
            return;
        }
        
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
            
        }
    }

    async renderActiveTrainers(trainers) {
        const container = document.getElementById('trainersList');
        if (!container) {
            return;
        }
        
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

        const approveExperienceInput = document.getElementById('trainerExperience');
        if (approveExperienceInput) {
            approveExperienceInput.addEventListener('input', function () {
                const value = this.value.trim();
                if (value === '') {
                    this.setCustomValidity('Укажите опыт работы');
                } else if (!/^\d+$/.test(value)) {
                    this.setCustomValidity('Опыт работы должен быть целым числом');
                } else {
                    this.setCustomValidity('');
                }
            });
        }

        const editExperienceInput = document.getElementById('editExperience');
        if (editExperienceInput) {
            editExperienceInput.addEventListener('input', function () {
                const value = this.value.trim();
                if (value === '') {
                    this.setCustomValidity('Укажите опыт работы');
                } else if (!/^\d+$/.test(value)) {
                    this.setCustomValidity('Опыт работы должен быть целым числом');
                } else {
                    this.setCustomValidity('');
                }
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
        
        const preview = document.getElementById('approvePhotoPreview');
        if (preview) preview.innerHTML = '';
    }

    static async approveTrainer() {
        const specialty = document.getElementById('trainerSpecialty').value;
        const experience = document.getElementById('trainerExperience').value;
        const description = document.getElementById('trainerDescription').value;
        const photoFile = document.getElementById('trainerPhoto').files[0];

        const formData = new FormData();
        formData.append('specialty', specialty);
        formData.append('experience', experience);
        formData.append('description', description);
        if (photoFile) {
            formData.append('photo', photoFile);
        }

        try {
            const headers = AuthService.getAuthHeaders();
            delete headers['Content-Type']; 
            
            const response = await fetch(`/api/admin/approve-trainer/${TrainerManagement.approvingTrainerId}`, {
                method: 'POST',
                headers: headers,
                body: formData
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
                
                
                const form = document.getElementById('editTrainerForm');
                if (form) form.reset();
                
                
                const photoInput = document.getElementById('editTrainerPhoto');
                if (photoInput) photoInput.value = '';
                
                
                const nameEl = document.getElementById('editTrainerName');
                if (nameEl) {
                    nameEl.textContent = `${user.first_name} ${user.last_name}`;
                }
                
                document.getElementById('editSpecialty').value = profile.specialty || '';
                document.getElementById('editExperience').value = profile.experience || profile.experience_years || '';
                document.getElementById('editDescription').value = profile.description || profile.bio || '';
                
                const currentPhotoDiv = document.getElementById('currentTrainerPhoto');
                
                const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
                let photoHTML = '<div style="display: flex; justify-content: center; margin: 1rem 0;">';
                photoHTML += `<img src="/images/trainers/trainer-${trainerId}.jpg" alt="Фото тренера" 
                             style="width: 200px; height: 200px; border-radius: 50%; object-fit: cover; border: 4px solid var(--primary); box-shadow: var(--shadow);"
                             onerror="this.onerror=null; this.src='/images/trainers/trainer-${trainerId}.jpeg'; this.onerror=function(){this.src='/images/trainers/trainer-${trainerId}.png'; this.onerror=function(){this.src='/images/trainers/trainer-${trainerId}.gif'; this.onerror=function(){this.style.display=\'none\'; this.nextElementSibling.style.display=\'block\';};};};">`;
                photoHTML += '<p style="display: none; color: var(--text-light); text-align: center;">Фото не загружено</p>';
                photoHTML += '</div>';
                currentPhotoDiv.innerHTML = photoHTML;
                
                document.getElementById('editTrainerModal').classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            }
        } catch (error) {
            alert('Ошибка загрузки данных тренера');
        }
    }

    static closeEditModal() {
        document.getElementById('editTrainerModal').classList.add('hidden');
        document.body.style.overflow = 'auto';
        document.getElementById('editTrainerMessage').classList.add('hidden');
        TrainerManagement.editingTrainerId = null;
        
        const form = document.getElementById('editTrainerForm');
        if (form) form.reset();
        const photoInput = document.getElementById('editTrainerPhoto');
        if (photoInput) photoInput.value = '';
    }

    static previewPhoto(input, previewId) {
        const preview = document.getElementById(previewId);
        if (!preview || !input.files || !input.files[0]) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <img src="${e.target.result}" 
                         style="width: 200px; height: 200px; border-radius: 50%; object-fit: cover; border: 4px solid var(--primary); box-shadow: var(--shadow);"
                         alt="Превью фото">
                    <p style="margin-top: 0.5rem; color: var(--text-light); font-size: 0.9rem;">Предпросмотр</p>
                </div>
            `;
        };
        reader.readAsDataURL(input.files[0]);
    }

    static previewSelectedPhoto(input) {
        const currentPhotoDiv = document.getElementById('currentTrainerPhoto');
        if (!currentPhotoDiv || !input.files || !input.files[0]) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            currentPhotoDiv.innerHTML = `
                <img src="${e.target.result}" 
                     style="width: 200px; height: 200px; border-radius: 50%; object-fit: cover; border: 4px solid var(--primary); box-shadow: var(--shadow);"
                     alt="Выбранное фото тренера">
            `;
        };
        reader.readAsDataURL(input.files[0]);
    }

    static async saveTrainer() {
        const profileData = {
            specialty: document.getElementById('editSpecialty').value,
            experience: document.getElementById('editExperience').value,
            description: document.getElementById('editDescription').value
        };
        
        const photoFile = document.getElementById('editTrainerPhoto').files[0];

        try {
            
            const formData = new FormData();
            formData.append('specialty', profileData.specialty);
            formData.append('experience', profileData.experience);
            formData.append('description', profileData.description);
            if (photoFile) {
                formData.append('photo', photoFile);
            }
            
            const headers = AuthService.getAuthHeaders();
            delete headers['Content-Type'];
            
            const profileResponse = await fetch(`/api/admin/trainers/${TrainerManagement.editingTrainerId}/profile`, {
                method: 'PUT',
                headers: headers,
                body: formData
            });

            if (profileResponse.ok) {
                const messageEl = document.getElementById('editTrainerMessage');
                messageEl.textContent = 'Тренер успешно обновлен';
                messageEl.className = 'message success';
                messageEl.classList.remove('hidden');
                
                
                setTimeout(() => {
                    TrainerManagement.closeEditModal();
                    location.reload();
                }, 1000);
            } else {
                const errorData = await profileResponse.json().catch(() => ({ message: 'Ошибка сохранения' }));
                const messageEl = document.getElementById('editTrainerMessage');
                messageEl.textContent = errorData.message || 'Ошибка сохранения профиля тренера';
                messageEl.className = 'message error';
                messageEl.classList.remove('hidden');
                
            }
        } catch (error) {
            const messageEl = document.getElementById('editTrainerMessage');
            messageEl.textContent = 'Произошла ошибка при сохранении. Проверьте подключение к интернету.';
            messageEl.className = 'message error';
            messageEl.classList.remove('hidden');
        }
    }

    static getPageContent() {
        return `
            <div class="main-content">
                <div class="container">
                    <h1>Управление тренерами</h1>

                    <div class="card">
                        <div class="card-header">
                            <h2>Тренеры на подтверждение</h2>
                        </div>
                        <div id="pendingTrainersList">
                        </div>
                    </div>

                    <div class="card mt-4" style="margin-top: 2rem;">
                        <div class="card-header">
                            <h2>Активные тренеры</h2>
                        </div>
                        <div id="trainersList">
                        </div>
                    </div>
                </div>
            </div>

            <div id="approveTrainerModal" class="modal hidden">
                <div class="modal-content" style="max-width: 600px; min-height: 650px;">
                    <span class="close" onclick="TrainerManagement.closeApproveModal()">&times;</span>
                    <h2 class="text-center">Подтверждение тренера</h2>

                    <form id="approveTrainerForm" style="display: flex; flex-direction: column; gap: 1.25rem;">
                        <div class="approve-trainer-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; align-items: flex-start;">
                            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                                <div class="form-group" style="margin: 0;">
                                    <label class="form-label">Имя: <span id="approveFirstName"></span></label>
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label class="form-label">Фамилия: <span id="approveLastName"></span></label>
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label class="form-label">Email: <span id="approveEmail"></span></label>
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label for="trainerSpecialty" class="form-label">Специализация</label>
                                    <input type="text" id="trainerSpecialty" class="form-control" required>
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label for="trainerExperience" class="form-label">Опыт работы (лет)</label>
                                    <input type="number" id="trainerExperience" class="form-control" required min="0" step="1">
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label for="trainerDescription" class="form-label">Описание</label>
                                    <textarea id="trainerDescription" class="form-control" rows="4" required></textarea>
                                </div>
                            </div>

                            <div class="form-group" style="margin: 0;">
                                <label for="trainerPhoto" class="form-label">Фото тренера</label>
                                <div style="border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem; background: var(--light); display: flex; flex-direction: column; gap: 0.75rem;">
                                    <div id="approvePhotoPreview" style="min-height: 180px; border-radius: var(--radius); overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center;"></div>
                                    <input type="file" id="trainerPhoto" class="form-control" accept="image/*" onchange="TrainerManagement.previewPhoto(this, 'approvePhotoPreview')">
                                    <small class="form-text" style="color: var(--text-light);">Загрузите фото тренера (рекомендуется квадратное изображение)</small>
                                </div>
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary" style="align-self: flex-end; min-width: 220px;">Подтвердить тренера</button>
                    </form>
                </div>
            </div>

            <div id="editTrainerModal" class="modal hidden">
                <div class="modal-content" style="max-width: 600px; min-height: 650px;">
                    <span class="close" onclick="TrainerManagement.closeEditModal()">&times;</span>
                    <h2 class="text-center">Редактировать тренера</h2>
                    <p id="editTrainerName" class="text-center" style="margin-top: 0.5rem; color: var(--text-light); font-size: 1rem;"></p>

                    <form id="editTrainerForm" style="display: flex; flex-direction: column; gap: 1.25rem;">
                        <div class="edit-trainer-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; align-items: flex-start;">
                            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                                <div class="form-group" style="margin: 0;">
                                    <label for="editSpecialty" class="form-label">Специализация</label>
                                    <input type="text" id="editSpecialty" class="form-control" required>
                                </div>

                                <div class="form-group" style="margin: 0;">
                                    <label for="editExperience" class="form-label">Опыт работы (лет)</label>
                                    <input type="number" id="editExperience" class="form-control" required min="0" step="1">
                                </div>

                                <div class="form-group" style="margin: 0;">
                                    <label for="editDescription" class="form-label">Описание</label>
                                    <textarea id="editDescription" class="form-control" rows="3" required style="resize: none;"></textarea>
                                </div>
                            </div>

                            <div class="form-group" style="margin: 0;">
                                <label for="editTrainerPhoto" class="form-label">Фото тренера</label>
                                <div style="border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem; background: var(--light); display: flex; flex-direction: column; gap: 0.75rem;">
                                    <div id="currentTrainerPhoto" style="min-height: 180px; border-radius: var(--radius); overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center;"></div>
                                    <input type="file" id="editTrainerPhoto" class="form-control" accept="image/*" onchange="TrainerManagement.previewSelectedPhoto(this)">
                                    <small class="form-text" style="color: var(--text-light);">Загрузите новое фото (оставьте поле пустым, чтобы сохранить текущее)</small>
                                </div>
                            </div>
                        </div>

                        <button type="submit" class="btn btn-primary" style="align-self: flex-end; min-width: 220px;">Сохранить изменения</button>
                    </form>
                    <div id="editTrainerMessage" class="message hidden"></div>
                </div>
            </div>
        `;
    }
}


window.TrainerManagement = TrainerManagement;

