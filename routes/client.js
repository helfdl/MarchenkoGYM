const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/subscriptions', requireAuth, requireRole(['client']), async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const subscriptions = await query(`
            SELECT s.*, st.name as type_name, st.category, st.duration_months, st.visits_count
            FROM subscriptions s
            INNER JOIN subscription_types st ON s.type_id = st.type_id
            WHERE s.user_id = ? AND s.is_active = TRUE AND s.end_date >= CURDATE()
            ORDER BY s.end_date DESC
        `, [userId]);
        
        res.json(subscriptions);
    } catch (error) {
        console.error('Ошибка получения абонементов клиента:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/bookings', requireAuth, requireRole(['client']), async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const bookings = await query(`
            SELECT b.*, s.session_date, s.start_time, s.end_time, s.session_type,
                   u.first_name as trainer_first_name, u.last_name as trainer_last_name,
                   tp.name as program_name
            FROM bookings b
            INNER JOIN schedule s ON b.schedule_id = s.schedule_id
            INNER JOIN users u ON s.trainer_id = u.user_id
            LEFT JOIN trainer_programs tp ON s.program_id = tp.program_id
            WHERE b.user_id = ?
            ORDER BY s.session_date DESC, s.start_time DESC
        `, [userId]);
        
        res.json(bookings);
    } catch (error) {
        console.error('Ошибка получения бронирований клиента:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.put('/profile', requireAuth, requireRole(['client']), async (req, res) => {
    try {
        const userId = req.user.userId;
        const { first_name, last_name, email, phone, password } = req.body;

        const existingUser = await query('SELECT user_id FROM users WHERE email = ? AND user_id != ?', [email, userId]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
        }

        let updateQuery = 'UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE user_id = ? AND role = "client"';
        let params = [first_name, last_name, email, phone, userId];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateQuery = 'UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, password_hash = ? WHERE user_id = ? AND role = "client"';
            params = [first_name, last_name, email, phone, hashedPassword, userId];
        }

        await query(updateQuery, params);

        res.json({ message: 'Профиль успешно обновлен' });
    } catch (error) {
        console.error('Ошибка обновления профиля клиента:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

module.exports = router;