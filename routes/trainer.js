const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/schedule', requireAuth, requireRole(['trainer']), async (req, res) => {
    try {
        const trainerId = req.user.userId;
        
        const schedule = await query(`
            SELECT s.*, tp.name as program_name, 
                   COUNT(b.booking_id) as booked_clients
            FROM schedule s
            LEFT JOIN trainer_programs tp ON s.program_id = tp.program_id
            LEFT JOIN bookings b ON s.schedule_id = b.schedule_id AND b.status = 'booked'
            WHERE s.trainer_id = ? AND s.is_cancelled = FALSE
            AND s.session_date >= CURDATE()
            GROUP BY s.schedule_id
            ORDER BY s.session_date, s.start_time
        `, [trainerId]);
        
        res.json(schedule);
    } catch (error) {
        console.error('Ошибка получения расписания тренера:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/clients', requireAuth, requireRole(['trainer']), async (req, res) => {
    try {
        const trainerId = req.user.userId;
        
        const clients = await query(`
            SELECT DISTINCT u.user_id, u.first_name, u.last_name, u.email, u.phone,
                   COUNT(DISTINCT a.attendance_id) as total_visits
            FROM users u
            INNER JOIN bookings b ON u.user_id = b.user_id
            INNER JOIN schedule s ON b.schedule_id = s.schedule_id
            LEFT JOIN attendance a ON u.user_id = a.user_id AND a.schedule_id = s.schedule_id
            WHERE s.trainer_id = ? AND u.role = 'client' AND u.is_active = TRUE
            GROUP BY u.user_id
            ORDER BY u.first_name, u.last_name
        `, [trainerId]);
        
        res.json(clients);
    } catch (error) {
        console.error('Ошибка получения клиентов тренера:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.put('/profile', requireAuth, requireRole(['trainer']), async (req, res) => {
    try {
        const userId = req.user.userId;
        const { first_name, last_name, email, phone, password } = req.body;

        const existingUser = await query('SELECT user_id FROM users WHERE email = ? AND user_id != ?', [email, userId]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
        }

        let updateQuery = 'UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE user_id = ? AND role = "trainer"';
        let params = [first_name, last_name, email, phone, userId];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateQuery = 'UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, password_hash = ? WHERE user_id = ? AND role = "trainer"';
            params = [first_name, last_name, email, phone, hashedPassword, userId];
        }

        await query(updateQuery, params);

        res.json({ message: 'Профиль успешно обновлен' });
    } catch (error) {
        console.error('Ошибка обновления профиля тренера:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

module.exports = router;