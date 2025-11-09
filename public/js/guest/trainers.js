class Trainers {
    static async loadTrainers() {
        try {
            const response = await fetch('/api/public/trainers');
            if (response.ok) {
                const trainers = await response.json();
                this.renderTrainers(trainers);
            }
        } catch (error) {
            console.error('Ошибка загрузки тренеров:', error);
        }
    }

    static renderTrainers(trainers) {
        const container = document.getElementById('trainers-list');
        
        if (!trainers || trainers.length === 0) {
            container.innerHTML = '<p>Информация о тренерах временно недоступна</p>';
            return;
        }

        container.innerHTML = trainers.map(trainer => `
            <div class="col">
                <div class="card trainer-card">
                    <div class="trainer-photo">
                        <img src="/images/trainers/trainer-${trainer.user_id}.jpg" 
                             alt="${trainer.first_name} ${trainer.last_name}"
                             onerror="this.src='/images/trainers/default.jpg'; this.onerror=null;">
                    </div>
                    <h3>${trainer.first_name} ${trainer.last_name}</h3>
                    ${trainer.specialty ? `
                        <p class="trainer-specialty">${trainer.specialty}</p>
                    ` : ''}
                    ${trainer.experience ? `
                        <p class="trainer-experience">Опыт: ${trainer.experience}</p>
                    ` : ''}
                    ${trainer.description ? `
                        <p class="trainer-description">${trainer.description}</p>
                    ` : ''}
                    ${trainer.programs_count > 0 ? `
                        <p class="trainer-programs">Программ: ${trainer.programs_count}</p>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    Trainers.loadTrainers();
});
