const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'gym-secret-key-2025';

router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password, role } = req.body;

        if (!['client', 'trainer'].includes(role)) {
            return res.status(400).json({ message: 'Неверная роль пользователя' });
        }

        const existingUser = await query('SELECT user_id FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const isActive = role === 'client';

        const result = await query(
            'INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [email, hashedPassword, firstName, lastName, phone, role, isActive]
        );

        res.json({
            message: role === 'client'
                ? 'Регистрация успешна! Теперь вы можете войти в систему.'
                : 'Заявка на регистрацию тренера отправлена! Ожидайте подтверждения администратора.',
            userId: result.insertId,
            requiresApproval: role === 'trainer'
        });

    } catch (error) {
        console.error('Ошибка регистрации:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const users = await query('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(401).json({ message: 'Неверный email или пароль' });
        }

        const user = users[0];

        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            return res.status(401).json({ message: 'Неверный email или пароль' });
        }

        if (user.is_active !== 1) {
            return res.status(401).json({
                message: user.role === 'trainer'
                    ? 'Аккаунт ожидает подтверждения администратора. Пожалуйста, подождите.'
                    : 'Аккаунт деактивирован. Обратитесь к администратору.'
            });
        }
        const token = jwt.sign(
            {
                userId: user.user_id,
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                user_id: user.user_id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role,
                phone: user.phone,
                total_visits: user.total_visits,
                discount_percent: user.discount_percent
            }
        });

    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

module.exports = router;