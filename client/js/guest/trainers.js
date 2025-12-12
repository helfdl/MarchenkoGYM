class Trainers {
    static async loadTrainers() {
        try {
            const response = await fetch('/api/public/trainers');
            if (response.ok) {
                const trainers = await response.json();
                this.renderTrainers(trainers);
            }
        } catch (error) {
            // Ошибка загрузки тренеров
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
                             onerror="Trainers.handleTrainerImageError(this, ${trainer.user_id})">
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

    static handleTrainerImageError(img, userId) {
        const src = img.src || '';
        const base = `/images/trainers/trainer-${userId}`;

        if (src.endsWith('.jpg')) {
            img.src = `${base}.jpeg`;
        } else if (src.endsWith('.jpeg')) {
            img.src = `${base}.png`;
        } else if (src.endsWith('.png')) {
            img.src = `${base}.gif`;
        } else if (src.endsWith('.gif')) {
            img.src = `${base}.webp`;
        } else {
            img.src = '/images/trainers/default.jpg';
        }
    }
}

window.Trainers = Trainers;

