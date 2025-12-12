const ScheduleModel = require('../models/Schedule');
const SubscriptionModel = require('../models/Subscription');
const TrainerModel = require('../models/Trainer');

async function getSchedule(req, res) {
    try {
        const schedule = await ScheduleModel.getPublicSchedule();
        res.json(schedule);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function getSubscriptionTypes(req, res) {
    try {
        const subscriptions = await SubscriptionModel.getActiveTypes();
        res.json(subscriptions);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function getTrainers(req, res) {
    try {
        const trainers = await TrainerModel.getPublicTrainers();

        const mappedTrainers = trainers.map(trainer => ({
            ...trainer,
            experience: trainer.experience_years || null,
            description: trainer.bio || null
        }));

        res.json(mappedTrainers);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

module.exports = {
    getSchedule,
    getSubscriptionTypes,
    getTrainers
};

