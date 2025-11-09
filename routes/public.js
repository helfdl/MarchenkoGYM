const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/schedule', async (req, res) => {
    try {
        const sql = `
            SELECT 
                s.schedule_id,
                s.session_type,
                s.session_date,
                s.start_time,
                s.end_time,
                s.max_participants,
                s.current_participants,
                s.is_cancelled,
                u.first_name as trainer_first_name,
                u.last_name as trainer_last_name,
                tp.name as program_name,
                tp.description as program_description
            FROM schedule s
            LEFT JOIN users u ON s.trainer_id = u.user_id
            LEFT JOIN trainer_programs tp ON s.program_id = tp.program_id
            WHERE s.session_date >= CURDATE()
            AND s.session_date <= DATE_ADD(CURDATE(), INTERVAL 2 MONTH)
            AND u.is_active = TRUE
            AND (tp.is_active = TRUE OR tp.is_active IS NULL)
            ORDER BY s.session_date, s.start_time
        `;
        
        const schedule = await db.query(sql);
        res.json(schedule);
    } catch (error) {
        console.error('Ошибка загрузки расписания:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/subscription-types', async (req, res) => {
    try {
        const sql = `
            SELECT 
                type_id,
                name,
                category,
                duration_months,
                visits_count,
                base_price,
                final_price,
                description,
                is_active
            FROM subscription_types
            WHERE is_active = TRUE
            ORDER BY category, final_price
        `;
        
        const subscriptions = await db.query(sql);
        res.json(subscriptions);
    } catch (error) {
        console.error('Ошибка загрузки абонементов:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/trainers', async (req, res) => {
    try {
        const sql = `
            SELECT 
                u.user_id,
                u.first_name,
                u.last_name,
                u.phone,
                u.total_visits,
                COUNT(DISTINCT tp.program_id) as programs_count,
                tpr.specialty,
                tpr.experience_years,
                tpr.bio
            FROM users u
            LEFT JOIN trainer_programs tp ON u.user_id = tp.trainer_id AND tp.is_active = TRUE
            LEFT JOIN trainer_profiles tpr ON u.user_id = tpr.trainer_id
            WHERE u.role = 'trainer' 
            AND u.is_active = TRUE
            GROUP BY u.user_id, tpr.specialty, tpr.experience_years, tpr.bio
            ORDER BY u.first_name, u.last_name
        `;
        
        const trainers = await db.query(sql);
        
        const mappedTrainers = trainers.map(trainer => ({
            ...trainer,
            experience: trainer.experience_years || null,
            description: trainer.bio || null
        }));
        
        res.json(mappedTrainers);
    } catch (error) {
        console.error('Ошибка загрузки тренеров:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

module.exports = router;