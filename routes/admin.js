const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard-stats', requireAdmin, async (req, res) => {
    try {
        const usersCountResult = await query('SELECT COUNT(*) as count FROM users WHERE is_active = TRUE');
        const clientsCountResult = await query('SELECT COUNT(*) as count FROM users WHERE role = "client" AND is_active = TRUE');
        const trainersCountResult = await query('SELECT COUNT(*) as count FROM users WHERE role = "trainer" AND is_active = TRUE');
        
        const today = new Date().toISOString().split('T')[0];
        const visitsCountResult = await query('SELECT COUNT(*) as count FROM attendance WHERE DATE(attendance_date) = ?', [today]);

        const pendingTrainersResult = await query('SELECT COUNT(*) as count FROM users WHERE role = "trainer" AND is_active = FALSE');

        const usersCount = usersCountResult[0] || { count: 0 };
        const clientsCount = clientsCountResult[0] || { count: 0 };
        const trainersCount = trainersCountResult[0] || { count: 0 };
        const visitsCount = visitsCountResult[0] || { count: 0 };
        const pendingTrainers = pendingTrainersResult[0] || { count: 0 };

        res.json({
            totalUsers: usersCount.count,
            activeClients: clientsCount.count,
            totalTrainers: trainersCount.count,
            todayVisits: visitsCount.count,
            pendingTrainers: pendingTrainers.count
        });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/recent-activities', requireAdmin, async (req, res) => {
    try {
        const activities = await query(`
            (SELECT 'subscription' as type, s.purchase_date as date, 
                    CONCAT(u.first_name, ' ', u.last_name, ' приобрел абонемент') as description,
                    u.first_name, u.last_name
             FROM subscriptions s 
             JOIN users u ON s.user_id = u.user_id 
             ORDER BY s.purchase_date DESC LIMIT 5)
            UNION
            (SELECT 'registration' as type, u.created_at as date,
                    CONCAT(u.first_name, ' ', u.last_name, ' зарегистрировался') as description,
                    u.first_name, u.last_name
             FROM users u 
             ORDER BY u.created_at DESC LIMIT 5)
            UNION
            (SELECT 'attendance' as type, a.attendance_date as date,
                    CONCAT(u.first_name, ' ', u.last_name, ' посетил тренировку') as description,
                    u.first_name, u.last_name
             FROM attendance a 
             JOIN users u ON a.user_id = u.user_id 
             ORDER BY a.attendance_date DESC LIMIT 5)
            ORDER BY date DESC LIMIT 10
        `);
        res.json(activities);
    } catch (error) {
        console.error('Ошибка получения активностей:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/subscription-types', requireAdmin, async (req, res) => {
    try {
        const types = await query('SELECT * FROM subscription_types ORDER BY category, base_price');
        res.json(types);
    } catch (error) {
        console.error('Ошибка получения типов абонементов:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/subscription-types/:id', requireAdmin, async (req, res) => {
    try {
        const typeId = req.params.id;
        const [type] = await query('SELECT * FROM subscription_types WHERE type_id = ?', [typeId]);
        
        if (!type) {
            return res.status(404).json({ message: 'Тип абонемента не найден' });
        }
        
        res.json(type);
    } catch (error) {
        console.error('Ошибка получения типа абонемента:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.post('/subscription-types', requireAdmin, async (req, res) => {
    try {
        const { name, category, duration_months, visits_count, base_price, final_price, description } = req.body;

        const result = await query(
            `INSERT INTO subscription_types (name, category, duration_months, visits_count, base_price, final_price, description) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, category, duration_months || null, visits_count || null, base_price, final_price, description]
        );

        res.json({
            message: 'Тип абонемента успешно создан',
            typeId: result.insertId
        });
    } catch (error) {
        console.error('Ошибка создания типа абонемента:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/schedule', requireAdmin, async (req, res) => {
    try {
        const schedule = await query(`
            SELECT s.*, 
                   u.first_name as trainer_first_name, 
                   u.last_name as trainer_last_name,
                   tp.name as program_name,
                   COUNT(b.booking_id) as current_bookings
            FROM schedule s
            LEFT JOIN users u ON s.trainer_id = u.user_id
            LEFT JOIN trainer_programs tp ON s.program_id = tp.program_id
            LEFT JOIN bookings b ON s.schedule_id = b.schedule_id AND b.status = 'booked'
            WHERE s.session_date >= CURDATE()
            GROUP BY s.schedule_id
            ORDER BY s.session_date, s.start_time
        `);
        res.json(schedule);
    } catch (error) {
        console.error('Ошибка получения расписания:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.post('/schedule', requireAdmin, async (req, res) => {
    try {
        const { trainer_id, program_id, session_type, session_date, start_time, end_time, max_participants } = req.body;

        const result = await query(
            `INSERT INTO schedule (trainer_id, program_id, session_type, session_date, start_time, end_time, max_participants) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [trainer_id, program_id, session_type, session_date, start_time, end_time, max_participants || 1]
        );

        res.json({
            message: 'Занятие успешно добавлено в расписание',
            scheduleId: result.insertId
        });
    } catch (error) {
        console.error('Ошибка добавления занятия:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.put('/schedule/:id', requireAdmin, async (req, res) => {
    try {
        const scheduleId = req.params.id;
        const { trainer_id, program_id, session_type, session_date, start_time, end_time, max_participants } = req.body;

        await query(
            `UPDATE schedule 
             SET trainer_id = ?, program_id = ?, session_type = ?, session_date = ?, start_time = ?, end_time = ?, max_participants = ?
             WHERE schedule_id = ?`,
            [trainer_id, program_id, session_type, session_date, start_time, end_time, max_participants || 1, scheduleId]
        );

        res.json({ message: 'Занятие успешно обновлено' });
    } catch (error) {
        console.error('Ошибка обновления занятия:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.delete('/schedule/:id', requireAdmin, async (req, res) => {
    try {
        const scheduleId = req.params.id;

        await query('DELETE FROM schedule WHERE schedule_id = ?', [scheduleId]);

        res.json({ message: 'Занятие успешно удалено' });
    } catch (error) {
        console.error('Ошибка удаления занятия:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.post('/schedule/:id/cancel', requireAdmin, async (req, res) => {
    try {
        const scheduleId = req.params.id;

        await query(
            'UPDATE schedule SET is_cancelled = TRUE WHERE schedule_id = ?',
            [scheduleId]
        );

        res.json({ message: 'Занятие отменено' });
    } catch (error) {
        console.error('Ошибка отмены занятия:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/analytics/attendance', requireAdmin, async (req, res) => {
    try {
        const { period = 'week' } = req.query;
        let dateCondition = 'DATE(a.attendance_date) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
        
        if (period === 'month') {
            dateCondition = 'DATE(a.attendance_date) >= DATE_SUB(CURDATE(), INTERVAL 1 MONTH)';
        } else if (period === 'year') {
            dateCondition = 'DATE(a.attendance_date) >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)';
        }

        const attendance = await query(`
            SELECT DATE(a.attendance_date) as date, COUNT(*) as count
            FROM attendance a
            WHERE ${dateCondition}
            GROUP BY DATE(a.attendance_date)
            ORDER BY date
        `);

        res.json(attendance);
    } catch (error) {
        console.error('Ошибка получения статистики посещаемости:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/analytics/revenue', requireAdmin, async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        let interval = 'INTERVAL 30 DAY';
        
        if (period === 'week') {
            interval = 'INTERVAL 7 DAY';
        } else if (period === 'year') {
            interval = 'INTERVAL 1 YEAR';
        }

        const revenue = await query(`
            SELECT DATE(s.purchase_date) as date, SUM(st.final_price) as amount
            FROM subscriptions s
            JOIN subscription_types st ON s.type_id = st.type_id
            WHERE s.purchase_date >= DATE_SUB(CURDATE(), ${interval})
            GROUP BY DATE(s.purchase_date)
            ORDER BY date
        `);

        res.json(revenue);
    } catch (error) {
        console.error('Ошибка получения статистики доходов:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/analytics/subscription-sales', requireAdmin, async (req, res) => {
    try {
        const sales = await query(`
            SELECT st.name, 
                   COUNT(s.subscription_id) as sold_count,
                   SUM(st.final_price) as total_revenue,
                   st.category
            FROM subscriptions s
            JOIN subscription_types st ON s.type_id = st.type_id
            WHERE s.purchase_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY st.type_id, st.name, st.category
            ORDER BY sold_count DESC
        `);

        res.json(sales);
    } catch (error) {
        console.error('Ошибка получения статистики продаж:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/analytics/trainer-stats', requireAdmin, async (req, res) => {
    try {
        const stats = await query(`
            SELECT 
                u.user_id,
                u.first_name,
                u.last_name,
                COUNT(DISTINCT s.schedule_id) as sessions_conducted,
                COUNT(DISTINCT b.user_id) as unique_clients,
                COUNT(a.attendance_id) as total_attendances,
                AVG(tp.price_per_session) as avg_session_price
            FROM users u
            LEFT JOIN schedule s ON u.user_id = s.trainer_id AND s.session_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            LEFT JOIN bookings b ON s.schedule_id = b.schedule_id
            LEFT JOIN attendance a ON s.schedule_id = a.schedule_id
            LEFT JOIN trainer_programs tp ON s.program_id = tp.program_id
            WHERE u.role = 'trainer' AND u.is_active = TRUE
            GROUP BY u.user_id, u.first_name, u.last_name
            ORDER BY sessions_conducted DESC
        `);

        res.json(stats);
    } catch (error) {
        console.error('Ошибка получения статистики тренеров:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.put('/users/:id/status', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { is_active } = req.body;

        await query(
            'UPDATE users SET is_active = ? WHERE user_id = ?',
            [is_active, userId]
        );

        res.json({ 
            message: `Пользователь успешно ${is_active ? 'разблокирован' : 'заблокирован'}` 
        });
    } catch (error) {
        console.error('Ошибка изменения статуса пользователя:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/pending-trainers', requireAdmin, async (req, res) => {
    try {
        const pendingTrainers = await query(`
            SELECT user_id, first_name, last_name, email, phone, created_at 
            FROM users 
            WHERE role = 'trainer' AND is_active = FALSE
            ORDER BY created_at DESC
        `);
        res.json(pendingTrainers);
    } catch (error) {
        console.error('Ошибка получения тренеров:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.post('/approve-trainer/:id', requireAdmin, async (req, res) => {
    try {
        const trainerId = req.params.id;
        const { specialty, experience, description } = req.body;

        await query('UPDATE users SET is_active = TRUE WHERE user_id = ? AND role = "trainer"', [trainerId]);

        const existingProfile = await query('SELECT trainer_id FROM trainer_profiles WHERE trainer_id = ?', [trainerId]);
        
        if (existingProfile.length > 0) {
            await query(
                'UPDATE trainer_profiles SET specialty = ?, experience_years = ?, bio = ? WHERE trainer_id = ?',
                [specialty, experience, description, trainerId]
            );
        } else {
            await query(
                'INSERT INTO trainer_profiles (trainer_id, specialty, experience_years, bio) VALUES (?, ?, ?, ?)',
                [trainerId, specialty, experience, description]
            );
        }

        res.json({ message: 'Тренер успешно подтвержден' });
    } catch (error) {
        console.error('Ошибка подтверждения тренера:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.delete('/reject-trainer/:id', requireAdmin, async (req, res) => {
    try {
        const trainerId = req.params.id;

        await query('DELETE FROM users WHERE user_id = ? AND role = "trainer"', [trainerId]);

        res.json({ message: 'Заявка тренера отклонена' });
    } catch (error) {
        console.error('Ошибка отклонения тренера:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/trainers', requireAdmin, async (req, res) => {
    try {
        const trainers = await query(`
            SELECT u.*, 
                   COUNT(tp.program_id) as programs_count
            FROM users u
            LEFT JOIN trainer_programs tp ON u.user_id = tp.trainer_id
            WHERE u.role = 'trainer' AND u.is_active = TRUE
            GROUP BY u.user_id
            ORDER BY u.first_name, u.last_name
        `);
        res.json(trainers);
    } catch (error) {
        console.error('Ошибка получения тренеров:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/trainers/:id/profile', requireAdmin, async (req, res) => {
    try {
        const trainerId = req.params.id;
        const [profile] = await query('SELECT * FROM trainer_profiles WHERE trainer_id = ?', [trainerId]);
        
        if (!profile) {
            return res.json({
                specialty: '',
                experience: '',
                description: '',
                rating: 0
            });
        }
        
        res.json({
            specialty: profile.specialty || '',
            experience: profile.experience_years || '',
            experience_years: profile.experience_years || '',
            description: profile.bio || '',
            bio: profile.bio || '',
            rating: profile.rating || 0
        });
    } catch (error) {
        console.error('Ошибка получения профиля тренера:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.put('/trainers/:id/profile', requireAdmin, async (req, res) => {
    try {
        const trainerId = req.params.id;
        const { specialty, experience, description, rating } = req.body;

        const existingProfile = await query('SELECT trainer_id FROM trainer_profiles WHERE trainer_id = ?', [trainerId]);
        
        if (existingProfile.length > 0) {
            await query(
                'UPDATE trainer_profiles SET specialty = ?, experience_years = ?, bio = ? WHERE trainer_id = ?',
                [specialty, experience, description, trainerId]
            );
        } else {
            await query(
                'INSERT INTO trainer_profiles (trainer_id, specialty, experience_years, bio, rating) VALUES (?, ?, ?, ?)',
                [trainerId, specialty, experience, description]
            );
        }

        res.json({ message: 'Профиль тренера успешно обновлен' });
    } catch (error) {
        console.error('Ошибка обновления профиля тренера:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.post('/trainers', requireAdmin, async (req, res) => {
    try {
        const { firstName, lastName, email, phone, password } = req.body;

        const existingUser = await query('SELECT user_id FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await query(
            'INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active) VALUES (?, ?, ?, ?, ?, "trainer", TRUE)',
            [email, hashedPassword, firstName, lastName, phone]
        );

        res.json({
            message: 'Тренер успешно добавлен',
            trainerId: result.insertId
        });

    } catch (error) {
        console.error('Ошибка добавления тренера:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/clients', requireAdmin, async (req, res) => {
    try {
        const clients = await query(`
            SELECT u.*, 
                   COUNT(DISTINCT s.subscription_id) as active_subscriptions,
                   COUNT(DISTINCT a.attendance_id) as total_visits
            FROM users u
            LEFT JOIN subscriptions s ON u.user_id = s.user_id AND s.is_active = TRUE
            LEFT JOIN attendance a ON u.user_id = a.user_id
            WHERE u.role = 'client' AND u.is_active = TRUE
            GROUP BY u.user_id
            ORDER BY u.created_at DESC
        `);
        res.json(clients);
    } catch (error) {
        console.error('Ошибка получения клиентов:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/clients/stats', requireAdmin, async (req, res) => {
    try {
        const totalClientsResult = await query('SELECT COUNT(*) as count FROM users WHERE role = "client" AND is_active = TRUE');
        const activeSubscriptionsResult = await query('SELECT COUNT(*) as count FROM subscriptions WHERE is_active = TRUE AND end_date >= CURDATE()');
        const avgVisitsResult = await query('SELECT AVG(total_visits) as avg FROM users WHERE role = "client" AND is_active = TRUE');
        const newThisMonthResult = await query('SELECT COUNT(*) as count FROM users WHERE role = "client" AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())');

        const totalClients = totalClientsResult[0] || { count: 0 };
        const activeSubscriptions = activeSubscriptionsResult[0] || { count: 0 };
        const avgVisits = avgVisitsResult[0] || { avg: 0 };
        const newThisMonth = newThisMonthResult[0] || { count: 0 };

        res.json({
            totalClients: totalClients.count,
            activeSubscriptions: activeSubscriptions.count,
            avgVisits: Math.round(avgVisits.avg || 0),
            newThisMonth: newThisMonth.count
        });
    } catch (error) {
        console.error('Ошибка получения статистики клиентов:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/clients/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const [user] = await query('SELECT * FROM users WHERE user_id = ? AND role = "client"', [userId]);
        
        if (!user) {
            return res.status(404).json({ message: 'Клиент не найден' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Ошибка получения клиента:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.post('/clients', requireAdmin, async (req, res) => {
    try {
        const { first_name, last_name, email, phone, password, discount_percent } = req.body;

        const existingUser = await query('SELECT user_id FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await query(
            'INSERT INTO users (email, password_hash, first_name, last_name, phone, role, discount_percent, is_active) VALUES (?, ?, ?, ?, ?, "client", ?, TRUE)',
            [email, hashedPassword, first_name, last_name, phone, discount_percent || 0]
        );

        res.json({
            message: 'Клиент успешно создан',
            userId: result.insertId
        });
    } catch (error) {
        console.error('Ошибка создания клиента:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.put('/clients/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { first_name, last_name, email, phone, password, discount_percent } = req.body;

        const existingUser = await query('SELECT user_id FROM users WHERE email = ? AND user_id != ?', [email, userId]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
        }

        let updateQuery = 'UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, discount_percent = ? WHERE user_id = ? AND role = "client"';
        let params = [first_name, last_name, email, phone, discount_percent || 0, userId];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateQuery = 'UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, discount_percent = ?, password_hash = ? WHERE user_id = ? AND role = "client"';
            params = [first_name, last_name, email, phone, discount_percent || 0, hashedPassword, userId];
        }

        await query(updateQuery, params);

        res.json({ message: 'Клиент успешно обновлен' });
    } catch (error) {
        console.error('Ошибка обновления клиента:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.delete('/clients/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        await query('DELETE FROM users WHERE user_id = ? AND role = "client"', [userId]);
        res.json({ message: 'Клиент успешно удален' });
    } catch (error) {
        console.error('Ошибка удаления клиента:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/clients/:id/subscriptions', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const subscriptions = await query(`
            SELECT s.*, st.name as type_name
            FROM subscriptions s
            JOIN subscription_types st ON s.type_id = st.type_id
            WHERE s.user_id = ?
            ORDER BY s.purchase_date DESC
        `, [userId]);
        res.json(subscriptions);
    } catch (error) {
        console.error('Ошибка получения абонементов клиента:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/accounts', requireAdmin, async (req, res) => {
    try {
        const { role } = req.query;
        let queryStr = 'SELECT * FROM users WHERE 1=1';
        const params = [];

        if (role && role !== 'all') {
            queryStr += ' AND role = ?';
            params.push(role);
        }

        queryStr += ' ORDER BY created_at DESC';

        const accounts = await query(queryStr, params);
        res.json(accounts);
    } catch (error) {
        console.error('Ошибка получения учетных записей:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/accounts/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const [user] = await query('SELECT * FROM users WHERE user_id = ?', [userId]);
        
        if (!user) {
            return res.status(404).json({ message: 'Учетная запись не найдена' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Ошибка получения учетной записи:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.post('/accounts', requireAdmin, async (req, res) => {
    try {
        const { first_name, last_name, email, phone, role, password, is_active } = req.body;

        const existingUser = await query('SELECT user_id FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await query(
            'INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [email, hashedPassword, first_name, last_name, phone, role, is_active !== false]
        );

        res.json({
            message: 'Учетная запись успешно создана',
            userId: result.insertId
        });
    } catch (error) {
        console.error('Ошибка создания учетной записи:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.put('/accounts/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { first_name, last_name, email, phone, role, password, is_active } = req.body;

        const existingUser = await query('SELECT user_id FROM users WHERE email = ? AND user_id != ?', [email, userId]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
        }

        let updateQuery = 'UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, role = ?, is_active = ? WHERE user_id = ?';
        let params = [first_name, last_name, email, phone, role, is_active !== false, userId];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            updateQuery = 'UPDATE users SET first_name = ?, last_name = ?, email = ?, phone = ?, role = ?, is_active = ?, password_hash = ? WHERE user_id = ?';
            params = [first_name, last_name, email, phone, role, is_active !== false, hashedPassword, userId];
        }

        await query(updateQuery, params);

        res.json({ message: 'Учетная запись успешно обновлена' });
    } catch (error) {
        console.error('Ошибка обновления учетной записи:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.delete('/accounts/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        const [user] = await query('SELECT role FROM users WHERE user_id = ?', [userId]);
        if (user && user.role === 'admin') {
            return res.status(400).json({ message: 'Нельзя удалить администратора' });
        }

        await query('DELETE FROM users WHERE user_id = ?', [userId]);
        res.json({ message: 'Учетная запись успешно удалена' });
    } catch (error) {
        console.error('Ошибка удаления учетной записи:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.put('/subscription-types/:id', requireAdmin, async (req, res) => {
    try {
        const typeId = req.params.id;
        const { name, category, duration_months, visits_count, base_price, final_price, description, is_active } = req.body;

        await query(
            `UPDATE subscription_types 
             SET name = ?, category = ?, duration_months = ?, visits_count = ?, base_price = ?, final_price = ?, description = ?, is_active = ?
             WHERE type_id = ?`,
            [name, category, duration_months || null, visits_count || null, base_price, final_price, description, is_active !== false, typeId]
        );

        res.json({ message: 'Тип абонемента успешно обновлен' });
    } catch (error) {
        console.error('Ошибка обновления типа абонемента:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.delete('/subscription-types/:id', requireAdmin, async (req, res) => {
    try {
        const typeId = req.params.id;
        await query('UPDATE subscription_types SET is_active = FALSE WHERE type_id = ?', [typeId]);
        res.json({ message: 'Тип абонемента успешно удален' });
    } catch (error) {
        console.error('Ошибка удаления типа абонемента:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/active-subscriptions', requireAdmin, async (req, res) => {
    try {
        const subscriptions = await query(`
            SELECT s.*, 
                   st.name as type_name,
                   CONCAT(u.first_name, ' ', u.last_name) as client_name
            FROM subscriptions s
            JOIN subscription_types st ON s.type_id = st.type_id
            JOIN users u ON s.user_id = u.user_id
            WHERE s.is_active = TRUE AND s.end_date >= CURDATE()
            ORDER BY s.purchase_date DESC
            LIMIT 50
        `);
        res.json(subscriptions);
    } catch (error) {
        console.error('Ошибка получения активных абонементов:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/reports/summary', requireAdmin, async (req, res) => {
    try {
        const totalRevenueResult = await query(`
            SELECT SUM(st.final_price) as total 
            FROM subscriptions s
            JOIN subscription_types st ON s.type_id = st.type_id
        `);
        const totalSubscriptionsResult = await query('SELECT COUNT(*) as count FROM subscriptions');
        const activeClientsResult = await query('SELECT COUNT(*) as count FROM users WHERE role = "client" AND is_active = TRUE');
        const monthlyVisitsResult = await query('SELECT COUNT(*) as count FROM attendance WHERE MONTH(attendance_date) = MONTH(CURDATE()) AND YEAR(attendance_date) = YEAR(CURDATE())');

        const totalRevenue = totalRevenueResult[0] || { total: 0 };
        const totalSubscriptions = totalSubscriptionsResult[0] || { count: 0 };
        const activeClients = activeClientsResult[0] || { count: 0 };
        const monthlyVisits = monthlyVisitsResult[0] || { count: 0 };

        res.json({
            totalRevenue: parseFloat(totalRevenue.total || 0).toFixed(2),
            totalSubscriptions: totalSubscriptions.count,
            activeClients: activeClients.count,
            monthlyVisits: monthlyVisits.count
        });
    } catch (error) {
        console.error('Ошибка получения общей статистики:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/reports/subscription-revenue', requireAdmin, async (req, res) => {
    try {
        const revenue = await query(`
            SELECT 
                DATE_FORMAT(s.purchase_date, '%Y-%m') as period,
                COUNT(*) as count,
                SUM(st.final_price) as revenue
            FROM subscriptions s
            JOIN subscription_types st ON s.type_id = st.type_id
            WHERE s.purchase_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
            GROUP BY DATE_FORMAT(s.purchase_date, '%Y-%m')
            ORDER BY period DESC
        `);
        res.json(revenue);
    } catch (error) {
        console.error('Ошибка получения доходов от абонементов:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

router.get('/reports/category-stats', requireAdmin, async (req, res) => {
    try {
        const stats = await query(`
            SELECT 
                st.category,
                COUNT(s.subscription_id) as count,
                SUM(st.final_price) as total_revenue
            FROM subscriptions s
            JOIN subscription_types st ON s.type_id = st.type_id
            WHERE s.purchase_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
            GROUP BY st.category
            ORDER BY total_revenue DESC
        `);
        res.json(stats);
    } catch (error) {
        console.error('Ошибка получения статистики по категориям:', error);
        res.status(500).json({ message: 'Ошибка сервера' });
    }
});

module.exports = router;