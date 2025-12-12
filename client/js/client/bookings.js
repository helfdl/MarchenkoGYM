class ClientBookings {
    constructor() {
        this.checkAuth();
        this.availableSessions = [];
        this.activeSubscriptions = [];
        this.selectedDate = new Date().toISOString().split('T')[0];
        this.trainers = [];
        this.trainerSessions = {}; 
        this.currentTrainerSessionsList = []; 
        this.selectedTrainerSessionId = null; 
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
        await this.loadActiveSubscriptions();
        await this.loadTrainers();
        this.renderPageContent();
        
        const dateInput = document.getElementById('sessionDate');
        if (dateInput && !dateInput.value) {
            dateInput.value = this.selectedDate;
        }
        await this.loadAvailableSessions();
        this.setupEventListeners();
    }

    async loadTrainers() {
        try {
            const response = await fetch('/api/public/trainers', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                this.trainers = await response.json();
            }
        } catch (error) {
            
        }
    }

    async loadActiveSubscriptions() {
        try {
            const response = await fetch('/api/client/subscriptions', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                this.activeSubscriptions = await response.json();
            }
        } catch (error) {
            
        }
    }

    async loadAvailableSessions() {
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const container = document.getElementById('sessionsList');
        if (!container) {
            
            setTimeout(() => this.loadAvailableSessions(), 200);
            return;
        }
        
        try {
            container.innerHTML = '<p>Загрузка...</p>';
            const response = await fetch('/api/client/available-sessions?date=' + this.selectedDate, {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                this.availableSessions = await response.json();
                this.renderSessions();
            } else {
                const error = await response.json().catch(() => ({ message: 'Неизвестная ошибка' }));
                container.innerHTML = '<p style="color: red;">Ошибка загрузки: ' + (error.message || 'Неизвестная ошибка') + '</p>';
            }
        } catch (error) {
            if (container) {
                container.innerHTML = '<p style="color: red;">Ошибка загрузки доступных тренировок. Проверьте подключение к серверу.</p>';
            }
        }
    }

    renderSessions() {
        const container = document.getElementById('sessionsList');
        if (!container) return;

        if (this.availableSessions.length === 0) {
            container.innerHTML = '<p>На выбранную дату нет доступных тренировок</p>';
            return;
        }

        // Разделяем занятия по типу
        const groupSessions = this.availableSessions.filter(s => s.session_type === 'group');
        const individualSessions = this.availableSessions.filter(s => s.session_type === 'individual');

        // Сортируем по времени
        const sortByTime = function(a, b) {
            return a.start_time.localeCompare(b.start_time);
        };
        groupSessions.sort(sortByTime);
        individualSessions.sort(sortByTime);

        const dateStr = new Date(this.selectedDate).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        
        let html = '';
        
        if (groupSessions.length !== 0) {
            html += '<div style="margin-bottom: 2rem;">';
            html += '<h3 style="margin-bottom: 1rem;">Групповые тренировки</h3>';
            html += '<table class="data-table">';
            html += '<thead><tr>';
            html += '<th>Время</th>';
            html += '<th>Тренер</th>';
            html += '<th>Название</th>';
            html += '<th>Участников</th>';
            html += '<th>Действия</th>';
            html += '</tr></thead>';
            html += '<tbody>';
            
            groupSessions.forEach(function(session) {
                // Сервер уже вернул только те групповые занятия, на которые у клиента есть подходящий абонемент,
                // поэтому дополнительная проверка canBookSession здесь не нужна.
                const time = session.start_time.substring(0, 5) + ' - ' + session.end_time.substring(0, 5);
                const trainerName = session.trainer_first_name + ' ' + session.trainer_last_name;
                const sessionName = session.name || 'Без названия';
                const participants = (session.current_participants || 0) + '/' + session.max_participants;
                
                html += '<tr>';
                html += '<td>' + time + '</td>';
                html += '<td>' + trainerName + '</td>';
                html += '<td>' + sessionName + '</td>';
                html += '<td>' + participants + '</td>';
                html += '<td>';
                html += '<button class="btn btn-primary btn-sm" onclick="ClientBookings.openSessionDetails(' + session.schedule_id + ')">Записаться</button>';
                html += '</td>';
                html += '</tr>';
            }.bind(this));
            
            html += '</tbody></table>';
            html += '</div>';
        }
        
        if (individualSessions.length !== 0)  {
            html += '<div>';
            html += '<h3 style="margin-bottom: 1rem;">Индивидуальные тренировки</h3>';
            html += '<p>Нет доступных индивидуальных тренировок на эту дату</p>';

            const sessionsHtml = individualSessions.map(function(session) {
                return this.createSessionElement(session);
            }.bind(this)).join('');
            
            html += '<div class="calendar-sessions" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">';
            html += sessionsHtml;
            html += '</div>';

            html += '</div>';
        }
        
        container.innerHTML = html;
    }

    createSessionElement(session) {
        const canBook = this.canBookSession(session);
        const sessionType = session.session_type === 'individual' ? 'individual' : 'group';
        const time = session.start_time.substring(0, 5);
        const trainerName = session.trainer_first_name + ' ' + session.trainer_last_name;
        
        const sessionName = session.name || '';
        const sessionNameHtml = sessionName ? '<div class="session-program">' + sessionName + '</div>' : '';
        const opacityStyle = !canBook ? 'opacity: 0.6;' : '';
        const titleText = canBook ? 'Нажмите для просмотра деталей' : 'У вас нет подходящего абонемента';
        
        return '<div class="session-item ' + sessionType + '" ' +
               'onclick="ClientBookings.openSessionDetails(' + session.schedule_id + ')" ' +
               'style="cursor: pointer; ' + opacityStyle + '" ' +
               'title="' + titleText + '">' +
               '<div class="session-time">' + time + '</div>' +
               '<div class="session-trainer-name">' + trainerName + '</div>' +
               sessionNameHtml +
               '</div>';
    }

    createTrainerSessionElement(session) {
        const sessionType = session.session_type === 'individual' ? 'individual' : 'group';
        const time = session.start_time.substring(0, 5);
        const trainerName = session.trainer_first_name + ' ' + session.trainer_last_name;
        
        const sessionName = session.name || '';
        const sessionNameHtml = sessionName ? '<div class="session-program">' + sessionName + '</div>' : '';
        
        return '<div class="session-item ' + sessionType + ' trainer-session-selectable" ' +
               'data-schedule-id="' + session.schedule_id + '" ' +
               'onclick="ClientBookings.selectTrainerSession(' + session.schedule_id + ')" ' +
               'style="cursor: pointer;" ' +
               'title="Нажмите для выбора тренировки">' +
               '<div class="session-time">' + time + '</div>' +
               '<div class="session-trainer-name">' + trainerName + '</div>' +
               sessionNameHtml +
               '</div>';
    }

    static openSessionDetails(scheduleId) {
        if (window.clientBookingsInstance) {
            window.clientBookingsInstance.showBookingModal(scheduleId);
        }
    }

    canBookSession(session) {
        if (this.activeSubscriptions.length === 0) return false;
        
        
        return this.activeSubscriptions.some(function(sub) {
            if (sub.category === 'combined') return true;
            if (session.session_type === 'group' && sub.category === 'group') return true;
            if (session.session_type === 'individual' && sub.category === 'gym') return true;
            return false;
        });
    }

    canBookIndividualSessions() {
        if (this.activeSubscriptions.length === 0) return false;
        
        
        return this.activeSubscriptions.some(function(sub) {
            return sub.category === 'combined' || sub.category === 'gym';
        });
    }

    canBookGroupSessions() {
        if (this.activeSubscriptions.length === 0) return false;
        
        
        return this.activeSubscriptions.some(function(sub) {
            return sub.category === 'combined' || sub.category === 'group';
        });
    }

    static bookSession(scheduleId) {
        if (window.clientBookingsInstance) {
            window.clientBookingsInstance.showBookingModal(scheduleId);
        }
    }

    async showBookingModal(scheduleId) {
        
        let session = this.availableSessions.find(function(s) {
            return s.schedule_id === scheduleId;
        });
        if (!session) {
            session = this.currentTrainerSessionsList.find(function(s) {
                return s.schedule_id === scheduleId;
            });
        }
        if (!session) return;

        const canBook = this.canBookSession(session);
        if (!canBook) {
            alert('У вас нет подходящего абонемента для этой тренировки');
            return;
        }

        
        let programDetails = [];
        try {
            const response = await fetch('/api/client/sessions/' + scheduleId + '/program', {
                headers: AuthService.getAuthHeaders()
            });
            if (response.ok) {
                const data = await response.json();
                programDetails = data.exercises || [];
            }
        } catch (error) {
            
        }

        const modal = document.getElementById('bookingModal');
        if (!modal) return;

        const date = new Date(session.session_date);
        document.getElementById('bookingDate').textContent = date.toLocaleDateString('ru-RU');
        document.getElementById('bookingTime').textContent = session.start_time.substring(0, 5) + ' - ' + session.end_time.substring(0, 5);
        document.getElementById('bookingTrainer').textContent = session.trainer_first_name + ' ' + session.trainer_last_name;
        document.getElementById('bookingType').textContent = session.session_type === 'individual' ? 'Индивидуальное' : 'Групповое';
        document.getElementById('bookingName').textContent = session.name || 'Без названия';
        
        
        const programContainer = document.getElementById('bookingProgram');
        if (programContainer) {
            if (programDetails && programDetails.length > 0) {
                const exercisesList = programDetails.map(function(ex) {
                    const duration = ex.duration_minutes ? ' (' + ex.duration_minutes + ' мин)' : '';
                    return '<li>' + ex.exercise_name + duration + '</li>';
                }).join('');
                programContainer.innerHTML = '<strong>Программа тренировки:</strong>' +
                    '<ul style="margin-top: 0.5rem; padding-left: 1.5rem;">' +
                    exercisesList +
                    '</ul>';
            } else {
                programContainer.innerHTML = '<p style="color: var(--text-light);">Программа тренировки не добавлена</p>';
            }
        }
        
        document.getElementById('bookingForm').dataset.scheduleId = scheduleId;

        modal.classList.remove('hidden');
    }

    static closeBookingModal() {
        const modal = document.getElementById('bookingModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    async bookSession() {
        const form = document.getElementById('bookingForm');
        const scheduleId = parseInt(form.dataset.scheduleId);
        if (!scheduleId) return;

        try {
            const authHeaders = AuthService.getAuthHeaders();
            const headers = {
                'Content-Type': 'application/json'
            };
            Object.assign(headers, authHeaders);
            
            const response = await fetch('/api/client/bookings', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ schedule_id: scheduleId })
            });

            const result = await response.json();

            if (response.ok) {
                this.showMessage('Вы успешно записались на тренировку!', 'success');
                setTimeout(function() {
                    ClientBookings.closeBookingModal();
                    this.loadAvailableSessions();
                }.bind(this), 1500);
            } else {
                this.showMessage(result.message || 'Ошибка записи на тренировку', 'error');
            }
        } catch (error) {
            this.showMessage('Ошибка записи на тренировку', 'error');
        }
    }

    showMessage(text, type) {
        const messageEl = document.getElementById('bookingMessage');
        if (messageEl) {
            messageEl.textContent = text;
            messageEl.className = 'message ' + type;
            messageEl.classList.remove('hidden');
            setTimeout(function() {
                messageEl.classList.add('hidden');
            }, 5000);
        }
    }

    setupEventListeners() {
        const dateInput = document.getElementById('sessionDate');
        if (dateInput) {
            dateInput.addEventListener('change', function(e) {
                this.selectedDate = e.target.value;
                this.loadAvailableSessions();
            }.bind(this));
        }

        const form = document.getElementById('bookingForm');
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                this.bookSession();
            }.bind(this));
        }

        const gymForm = document.getElementById('gymBookingForm');
        if (gymForm) {
            gymForm.addEventListener('submit', function(e) {
                e.preventDefault();
                this.bookGymSession();
            }.bind(this));
        }
        
        
        const trainerSelect = document.getElementById('gymBookingTrainer');
        if (trainerSelect) {
            trainerSelect.addEventListener('change', function(e) {
                this.loadTrainerSessions(parseInt(e.target.value));
            }.bind(this));
        }
        
        
        const gymDateInput = document.getElementById('gymBookingDate');
        const gymTimeInput = document.getElementById('gymBookingTime');
        if (gymDateInput) {
            gymDateInput.addEventListener('change', function() {
                this.updateTrainerSessions();
            }.bind(this));
        }
        if (gymTimeInput) {
            gymTimeInput.addEventListener('change', function() {
                this.updateTrainerSessions();
            }.bind(this));
        }
    }

    async loadTrainerSessions(trainerId) {
        if (!trainerId) {
            const container = document.getElementById('trainerSessionsList');
            if (container) {
                container.innerHTML = '';
                container.style.display = 'none';
            }
            return;
        }
        
        const date = document.getElementById('gymBookingDate').value;
        const time = document.getElementById('gymBookingTime').value;
        
        if (!date || !time) {
            return;
        }
        
        try {
            const response = await fetch('/api/client/available-sessions?date=' + date, {
                headers: AuthService.getAuthHeaders()
            });
            
            if (response.ok) {
                const allSessions = await response.json();
                
                
                const canBookIndividual = this.canBookIndividualSessions();
                const canBookGroup = this.canBookGroupSessions();
                
                
                
                
                const trainerSessions = allSessions.filter(function(s) {
                    if (s.trainer_id !== trainerId || s.start_time < time) {
                        return false;
                    }
                    
                    
                    if (!canBookIndividual && canBookGroup) {
                        return s.session_type === 'group';
                    }
                    
                    
                    return s.session_type === 'individual';
                });
                
                
                this.currentTrainerSessionsList = trainerSessions;
                
                const container = document.getElementById('trainerSessionsList');
                if (container) {
                    
                    this.selectedTrainerSessionId = null;
                    
                    if (trainerSessions.length === 0) {
                        const sessionTypeText = (!canBookIndividual && canBookGroup) ? 'групповых' : 'индивидуальных';
                        container.innerHTML = '<p style="color: var(--text-light); margin-top: 0.5rem;">У тренера нет доступных ' + sessionTypeText + ' тренировок после указанного времени</p>';
                    } else {
                        const sessionsHtml = trainerSessions.map(function(session) {
                            return this.createTrainerSessionElement(session);
                        }.bind(this)).join('');
                        
                        container.innerHTML = '<label class="form-label" style="margin-top: 0.5rem;">Доступные тренировки тренера (выберите одну):</label>' +
                            '<div class="calendar-sessions" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; margin-top: 0.5rem;">' +
                            sessionsHtml +
                            '</div>';
                    }
                    container.style.display = 'block';
                }
            }
        } catch (error) {
            
        }
    }
    
    updateTrainerSessions() {
        
        this.selectedTrainerSessionId = null;
        const trainerSelect = document.getElementById('gymBookingTrainer');
        if (trainerSelect && trainerSelect.value) {
            this.loadTrainerSessions(parseInt(trainerSelect.value));
        }
    }

    cleanup() {
        
    }

    static getPageContent() {
        return '<div class="main-content">' +
            '<div class="container">' +
            '<h1>Тренировки</h1>' +
            '<div id="bookingsContent"></div>' +
            '</div>' +
            '</div>' +
    
            '<div id="bookingModal" class="modal hidden">' +
            '<div class="modal-content" style="max-width: 700px;">' +
            '<span class="close" onclick="ClientBookings.closeBookingModal()">&times;</span>' +
            '<h2 class="text-center">Запись на тренировку</h2>' +
            '<div class="booking-info" style="margin-bottom: 1.5rem; padding: 1rem; background: var(--light); border-radius: var(--radius);">' +
            '<p><strong>Дата:</strong> <span id="bookingDate"></span></p>' +
            '<p><strong>Время:</strong> <span id="bookingTime"></span></p>' +
            '<p><strong>Тренер:</strong> <span id="bookingTrainer"></span></p>' +
            '<p><strong>Тип:</strong> <span id="bookingType"></span></p>' +
            '<p><strong>Название:</strong> <span id="bookingName"></span></p>' +
            '<div id="bookingProgram" style="margin-top: 0.5rem;"></div>' +
            '</div>' +
            '<form id="bookingForm">' +
            '<p>Вы уверены, что хотите записаться на эту тренировку?</p>' +
            '<button type="submit" class="btn btn-primary" style="width: 100%;">Подтвердить запись</button>' +
            '</form>' +
            '<div id="bookingMessage" class="message hidden"></div>' +
            '</div>' +
            '</div>';
    }

    renderPageContent() {
        const container = document.getElementById('bookingsContent');
        if (!container) return;

        const hasGym = this.canBookIndividualSessions();
        const hasGroup = this.canBookGroupSessions();

        let html = '';

        
        if (hasGym) {
            const minDate = new Date().toISOString().split('T')[0];
            html += '<div class="card mt-4">' +
                '<div class="card-header">' +
                '<h2>Запись в тренажерный зал</h2>' +
                '</div>' +
                '<div class="card-body">' +
                '<form id="gymBookingForm">' +
                '<div class="form-group">' +
                '<label for="gymBookingDate" class="form-label">Дата посещения</label>' +
                '<input type="date" id="gymBookingDate" class="form-control" required min="' + minDate + '">' +
                '</div>' +
                '<div class="form-group">' +
                '<label for="gymBookingTime" class="form-label">Время прихода в зал</label>' +
                '<input type="time" id="gymBookingTime" class="form-control" required min="06:00" max="24:00">' +
                '</div>' +
                '<div class="form-group">' +
                '<label class="form-label">' +
                '<input type="checkbox" id="gymBookingWithTrainer" onchange="ClientBookings.toggleTrainerSelection()">' +
                ' Взять индивидуального тренера' +
                '</label>' +
                '</div>' +
                '<div class="form-group" id="trainerSelectionGroup" style="display: none;">' +
                '<label for="gymBookingTrainer" class="form-label">Выберите тренера</label>' +
                '<select id="gymBookingTrainer" class="form-control">' +
                '<option value="">Выберите тренера</option>' +
                '</select>' +
                '<div id="trainerSessionsList" style="display: none;"></div>' +
                '</div>' +
                '<button type="submit" id="gymBookingSubmitBtn" class="btn btn-primary">Записаться</button>' +
                '</form>' +
                '<div id="gymBookingMessage" class="message hidden"></div>' +
                '</div>' +
                '</div>';
        }

        
        if (hasGroup) {
            const minDate = new Date().toISOString().split('T')[0];
            html += '<div class="card mt-4">' +
                '<div class="card-header">' +
                '<h2>Запись на групповые занятия</h2>' +
                '</div>' +
                '<div class="card-body">' +
                '<div class="form-group">' +
                '<label for="sessionDate" class="form-label">Выберите дату</label>' +
                '<input type="date" id="sessionDate" class="form-control" value="' + this.selectedDate + '" min="' + minDate + '">' +
                '</div>' +
                '<div id="sessionsList"></div>' +
                '</div>' +
                '</div>';
        }

        container.innerHTML = html;
    }

    static toggleTrainerSelection() {
        const checkbox = document.getElementById('gymBookingWithTrainer');
        const trainerGroup = document.getElementById('trainerSelectionGroup');
        const trainerSelect = document.getElementById('gymBookingTrainer');
        const submitBtn = document.getElementById('gymBookingSubmitBtn');
        
        if (checkbox && trainerGroup && trainerSelect) {
            if (checkbox.checked) {
                trainerGroup.style.display = 'block';
                trainerSelect.required = true;
                
                if (submitBtn) {
                    submitBtn.style.display = 'none';
                }
                
                if (window.clientBookingsInstance) {
                    const trainersOptions = window.clientBookingsInstance.trainers.map(function(t) {
                        return '<option value="' + t.user_id + '">' + t.first_name + ' ' + t.last_name + '</option>';
                    }).join('');
                    trainerSelect.innerHTML = '<option value="">Выберите тренера</option>' + trainersOptions;
                }
            } else {
                trainerGroup.style.display = 'none';
                trainerSelect.required = false;
                trainerSelect.value = '';
                
                if (submitBtn) {
                    submitBtn.style.display = '';
                }
                if (window.clientBookingsInstance) {
                    window.clientBookingsInstance.selectedTrainerSessionId = null;
                }
                const container = document.getElementById('trainerSessionsList');
                if (container) {
                    container.innerHTML = '';
                    container.style.display = 'none';
                }
            }
        }
    }

    static selectTrainerSession(scheduleId) {
        if (window.clientBookingsInstance) {
            window.clientBookingsInstance.selectedTrainerSessionId = scheduleId;
            
            const container = document.getElementById('trainerSessionsList');
            if (container) {
                const sessionElements = container.querySelectorAll('.trainer-session-selectable');
                sessionElements.forEach(function(el) {
                    const elScheduleId = parseInt(el.getAttribute('data-schedule-id'));
                    if (elScheduleId === scheduleId) {
                        el.style.border = '2px solid var(--primary)';
                        el.style.boxShadow = '0 0 0 2px rgba(var(--primary-rgb), 0.2)';
                        
                        let selectedIndicator = el.querySelector('.selected-indicator');
                        if (!selectedIndicator) {
                            selectedIndicator = document.createElement('div');
                            selectedIndicator.className = 'selected-indicator';
                            selectedIndicator.style.cssText = 'margin-top: 0.5rem; color: var(--primary); font-weight: bold;';
                            selectedIndicator.textContent = '✓ Выбрано';
                            el.appendChild(selectedIndicator);
                        }
                    } else {
                        el.style.border = '';
                        el.style.boxShadow = '';
                        const selectedIndicator = el.querySelector('.selected-indicator');
                        if (selectedIndicator) {
                            selectedIndicator.remove();
                        }
                    }
                });
            }
            
            window.clientBookingsInstance.showBookingModal(scheduleId);
        }
    }

    async bookGymSession() {
        const form = document.getElementById('gymBookingForm');
        const date = document.getElementById('gymBookingDate').value;
        const time = document.getElementById('gymBookingTime').value;
        const withTrainer = document.getElementById('gymBookingWithTrainer').checked;
        const trainerId = document.getElementById('gymBookingTrainer').value;

        if (withTrainer && !trainerId) {
            this.showGymMessage('Выберите тренера', 'error');
            return;
        }

        if (withTrainer && !this.selectedTrainerSessionId) {
            this.showGymMessage('Выберите тренировку тренера', 'error');
            return;
        }

        try {
            const authHeaders = AuthService.getAuthHeaders();
            const headers = {
                'Content-Type': 'application/json'
            };
            Object.assign(headers, authHeaders);
            
            const response = await fetch('/api/client/gym-booking', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    date: date,
                    time: time,
                    trainer_id: withTrainer ? parseInt(trainerId) : null,
                    schedule_id: withTrainer && this.selectedTrainerSessionId ? this.selectedTrainerSessionId : null
                })
            });

            const result = await response.json();

            if (response.ok) {
                this.showGymMessage('Вы успешно записались в зал!', 'success');
                setTimeout(function() {
                    form.reset();
                    this.selectedTrainerSessionId = null;
                    document.getElementById('gymBookingMessage').classList.add('hidden');
                    const container = document.getElementById('trainerSessionsList');
                    if (container) {
                        container.innerHTML = '';
                        container.style.display = 'none';
                    }
                }.bind(this), 1500);
            } else {
                this.showGymMessage(result.message || 'Ошибка записи в зал', 'error');
            }
        } catch (error) {
            this.showGymMessage('Ошибка записи в зал', 'error');
        }
    }

    showGymMessage(text, type) {
        const messageEl = document.getElementById('gymBookingMessage');
        if (messageEl) {
            messageEl.textContent = text;
            messageEl.className = 'message ' + type;
            messageEl.classList.remove('hidden');
            setTimeout(function() {
                messageEl.classList.add('hidden');
            }, 5000);
        }
    }
}

window.ClientBookings = ClientBookings;
