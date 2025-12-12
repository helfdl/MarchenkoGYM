const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'gym-secret-key-2025';

async function register(req, res) {
    try {
        const { firstName, lastName, email, phone, password, role } = req.body;

        const nameRegex = /^[A-Za-zА-Яа-яЁё]+$/u;
        const phoneRegex = /^[0-9+\-]+$/;

        if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
            return res.status(400).json({ message: 'Имя и фамилия должны содержать только буквы' });
        }

        if (phone && !phoneRegex.test(phone)) {
            return res.status(400).json({ message: 'Номер телефона может содержать только цифры, а также символы + и -' });
        }

        if (!['client', 'trainer'].includes(role)) {
            return res.status(400).json({ message: 'Неверная роль пользователя' });
        }

        const existingUser = await UserModel.findByEmail(email);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const isActive = role === 'client';

        const result = await UserModel.createUser({
            email,
            passwordHash,
            firstName,
            lastName,
            phone,
            role,
            isActive
        });

        res.json({
            message: role === 'client'
                ? 'Регистрация успешна! Теперь вы можете войти в систему.'
                : 'Заявка на регистрацию тренера отправлена! Ожидайте подтверждения администратора.',
            userId: result.insertId,
            requiresApproval: role === 'trainer'
        });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body;
        const users = await UserModel.findByEmail(email);

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
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

module.exports = {
    register,
    login
};

