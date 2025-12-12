const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

function calculateDiscount(totalVisits = 0) {
    const discount = Math.floor(totalVisits / 10) * 10;
    return Math.min(discount, 15);
}

async function getClientDiscount(userId) {
    const [user] = await query('SELECT total_visits, discount_percent FROM users WHERE user_id = ?', [userId]);
    if (!user) {
        return { totalVisits: 0, discountPercent: 0 };
    }
    const discountPercent = user.discount_percent ?? calculateDiscount(user.total_visits || 0);
    return { totalVisits: user.total_visits || 0, discountPercent };
}

async function getActiveSubscriptions(req, res) {
    try {
        const userId = req.user.userId;
        const subscriptions = await query(`
            SELECT s.*, st.name as type_name, st.category, st.duration_months, st.visits_count,
                   CASE 
                       WHEN s.visits_remaining IS NULL THEN NULL
                       WHEN st.visits_count IS NOT NULL AND s.visits_remaining > st.visits_count THEN st.visits_count
                       ELSE s.visits_remaining
                   END as corrected_visits_remaining
            FROM subscriptions s
            INNER JOIN subscription_types st ON s.type_id = st.type_id
            WHERE s.user_id = ? AND s.is_active = TRUE AND s.end_date >= CURDATE()
            ORDER BY s.end_date DESC
        `, [userId]);
        
        
        for (const sub of subscriptions) {
            if (sub.visits_count !== null && sub.visits_remaining !== null && sub.visits_remaining > sub.visits_count) {
                await query('UPDATE subscriptions SET visits_remaining = ? WHERE subscription_id = ?', [sub.visits_count, sub.subscription_id]);
                sub.visits_remaining = sub.visits_count;
            }
            
            if (sub.visits_count !== null && sub.visits_remaining !== null && sub.visits_remaining === 0) {
                await query('UPDATE subscriptions SET is_active = FALSE WHERE subscription_id = ?', [sub.subscription_id]);
            }
        }

        res.json(subscriptions);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function getBookings(req, res) {
    try {
        const userId = req.user.userId;
        const bookings = await query(`
            SELECT b.*, s.session_date, s.start_time, s.end_time, s.session_type,
                   s.name, u.first_name as trainer_first_name, u.last_name as trainer_last_name
            FROM bookings b
            INNER JOIN schedule s ON b.schedule_id = s.schedule_id
            INNER JOIN users u ON s.trainer_id = u.user_id
            LEFT JOIN trainer_programs tp ON s.program_id = tp.program_id
            WHERE b.user_id = ?
            ORDER BY s.session_date DESC, s.start_time DESC
        `, [userId]);

        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function getSubscriptionTypes(req, res) {
    try {
        const userId = req.user.userId;
        const { discountPercent } = await getClientDiscount(userId);

        const types = await query(`
            SELECT * FROM subscription_types
            WHERE is_active = TRUE
            ORDER BY category, base_price
        `);

        const typesWithDiscount = types.map(type => {
            const discountedPrice = type.base_price * (1 - discountPercent / 100);
            return {
                ...type,
                discount_percent: discountPercent,
                final_price: Math.round(discountedPrice * 100) / 100
            };
        });

        res.json(typesWithDiscount);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function purchaseSubscription(req, res) {
    try {
        const userId = req.user.userId;
        const { type_id } = req.body;

        if (!type_id) {
            return res.status(400).json({ message: 'Не указан тип абонемента' });
        }

        const type = await query('SELECT * FROM subscription_types WHERE type_id = ? AND is_active = TRUE', [type_id]);
        if (type.length === 0) {
            return res.status(400).json({ message: 'Тип абонемента не найден' });
        }

        const { discountPercent } = await getClientDiscount(userId);
        const finalPrice = type[0].base_price * (1 - discountPercent / 100);

        const startDate = new Date();
        const endDate = new Date(startDate);
        if (type[0].duration_months) {
            endDate.setMonth(endDate.getMonth() + type[0].duration_months);
        } else {
            endDate.setFullYear(endDate.getFullYear() + 1);
        }

        await query(`
            INSERT INTO subscriptions (user_id, type_id, start_date, end_date, visits_remaining, is_active)
            VALUES (?, ?, ?, ?, ?, TRUE)
        `, [
            userId,
            type_id,
            startDate.toISOString().split('T')[0],
            endDate.toISOString().split('T')[0],
            type[0].visits_count
        ]);

        res.json({ message: 'Абонемент успешно приобретен', price: finalPrice });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function getAvailableSessions(req, res) {
    try {
        const userId = req.user.userId;
        const { date } = req.query;

        const subscriptions = await query(`
            SELECT st.category FROM subscriptions s
            INNER JOIN subscription_types st ON s.type_id = st.type_id
            WHERE s.user_id = ? AND s.is_active = TRUE AND s.end_date >= CURDATE()
            AND (s.visits_remaining IS NULL OR s.visits_remaining > 0)
        `, [userId]);

        const categories = subscriptions.map(s => s.category);
        const hasCombined = categories.includes('combined');
        const hasGym = categories.includes('gym');
        const hasGroup = categories.includes('group');

        let sql = `
            SELECT s.*, s.name, u.first_name as trainer_first_name, u.last_name as trainer_last_name,
                   (SELECT COUNT(*) FROM bookings b WHERE b.schedule_id = s.schedule_id AND b.status = 'booked') as current_participants
            FROM schedule s
            INNER JOIN users u ON s.trainer_id = u.user_id
            LEFT JOIN trainer_programs tp ON s.program_id = tp.program_id
            WHERE s.is_cancelled = FALSE
        `;

        const params = [];
        if (date) {
            sql += ' AND DATE(s.session_date) = ?';
            params.push(date);
        }

        sql += ` AND (
            ${hasCombined ? 'TRUE' : 'FALSE'} OR
            (s.session_type = 'individual' AND ${hasGym ? 'TRUE' : 'FALSE'}) OR
            (s.session_type = 'group' AND ${hasGroup ? 'TRUE' : 'FALSE'})
        )
        AND s.schedule_id NOT IN (
            SELECT schedule_id FROM bookings 
            WHERE user_id = ? AND status = 'booked'
        )
        ORDER BY s.session_date, s.start_time`;

        params.push(userId);

        const sessions = await query(sql, params);
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function createBooking(req, res) {
    try {
        const userId = req.user.userId;
        const { schedule_id } = req.body;

        if (!schedule_id) {
            return res.status(400).json({ message: 'Не указана тренировка' });
        }

        const session = await query(`
            SELECT s.*, 
                   (SELECT COUNT(*) FROM bookings b WHERE b.schedule_id = s.schedule_id AND b.status = 'booked') as current_participants
            FROM schedule s
            WHERE s.schedule_id = ? AND s.is_cancelled = FALSE
        `, [schedule_id]);

        if (session.length === 0) {
            return res.status(400).json({ message: 'Тренировка не найдена' });
        }

        const existingBooking = await query(
            'SELECT booking_id FROM bookings WHERE user_id = ? AND schedule_id = ? AND status = "booked"',
            [userId, schedule_id]
        );
        if (existingBooking.length > 0) {
            return res.status(400).json({ message: 'Вы уже записаны на эту тренировку' });
        }

        if (session[0].session_type === 'group' && session[0].current_participants >= session[0].max_participants) {
            return res.status(400).json({ message: 'Нет свободных мест' });
        }

        await query(`
            INSERT INTO bookings (user_id, schedule_id, status)
            VALUES (?, ?, 'booked')
        `, [userId, schedule_id]);

        if (session[0].session_type === 'group') {
            await query(`
                UPDATE subscriptions s
                INNER JOIN subscription_types st ON s.type_id = st.type_id
                SET s.visits_remaining = CASE 
                    WHEN s.visits_remaining IS NULL THEN NULL
                    ELSE GREATEST(s.visits_remaining - 1, 0)
                END,
                s.is_active = CASE 
                    WHEN s.visits_remaining IS NULL THEN s.is_active
                    WHEN GREATEST(s.visits_remaining - 1, 0) = 0 THEN FALSE
                    ELSE s.is_active
                END
                WHERE s.subscription_id = (
                    SELECT subscription_id FROM (
                        SELECT s2.subscription_id
                        FROM subscriptions s2
                        INNER JOIN subscription_types st2 ON s2.type_id = st2.type_id
                        WHERE s2.user_id = ? 
                        AND s2.is_active = TRUE 
                        AND s2.end_date >= CURDATE()
                        AND (s2.visits_remaining IS NULL OR s2.visits_remaining > 0)
                        AND (st2.category = 'combined' OR st2.category = 'group')
                        ORDER BY s2.end_date ASC
                        LIMIT 1
                    ) AS sub
                )
            `, [userId]);
        } else if (session[0].session_type === 'individual') {
            await query(`
                UPDATE subscriptions s
                INNER JOIN subscription_types st ON s.type_id = st.type_id
                SET s.visits_remaining = CASE 
                    WHEN s.visits_remaining IS NULL THEN NULL
                    ELSE GREATEST(s.visits_remaining - 1, 0)
                END,
                s.is_active = CASE 
                    WHEN s.visits_remaining IS NULL THEN s.is_active
                    WHEN GREATEST(s.visits_remaining - 1, 0) = 0 THEN FALSE
                    ELSE s.is_active
                END
                WHERE s.subscription_id = (
                    SELECT subscription_id FROM (
                        SELECT s2.subscription_id
                        FROM subscriptions s2
                        INNER JOIN subscription_types st2 ON s2.type_id = st2.type_id
                        WHERE s2.user_id = ? 
                        AND s2.is_active = TRUE 
                        AND s2.end_date >= CURDATE()
                        AND (s2.visits_remaining IS NULL OR s2.visits_remaining > 0)
                        AND (st2.category = 'combined' OR st2.category = 'gym')
                        ORDER BY s2.end_date ASC
                        LIMIT 1
                    ) AS sub
                )
            `, [userId]);
        }

        res.json({ message: 'Вы успешно записались на тренировку' });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function bookGym(req, res) {
    try {
        const userId = req.user.userId;
        const { date, time, trainer_id } = req.body;

        if (!date || !time) {
            return res.status(400).json({ message: 'Укажите дату и время' });
        }

        const subscriptions = await query(`
            SELECT st.category FROM subscriptions s
            INNER JOIN subscription_types st ON s.type_id = st.type_id
            WHERE s.user_id = ? AND s.is_active = TRUE AND s.end_date >= CURDATE()
            AND (st.category = 'gym' OR st.category = 'combined')
        `, [userId]);

        if (subscriptions.length === 0) {
            return res.status(400).json({ message: 'У вас нет абонемента на тренажерный зал' });
        }

        if (trainer_id) {
            const trainerSessions = await query(`
                SELECT s.schedule_id FROM schedule s
                WHERE s.trainer_id = ? 
                AND DATE(s.session_date) = ?
                AND s.session_type = 'individual'
                AND s.is_cancelled = FALSE
                AND s.start_time >= ?
                AND s.schedule_id NOT IN (
                    SELECT schedule_id FROM bookings WHERE status = 'booked'
                )
                ORDER BY s.start_time ASC
                LIMIT 1
            `, [trainer_id, date, time]);

            if (trainerSessions.length === 0) {
                return res.status(400).json({ message: 'Тренер не доступен после указанного времени' });
            }

            const scheduleId = trainerSessions[0].schedule_id;
            await query(`
                INSERT INTO bookings (user_id, schedule_id, status)
                VALUES (?, ?, 'booked')
            `, [userId, scheduleId]);
        }

        const suitableSubscription = await query(`
            SELECT s.subscription_id
            FROM subscriptions s
            INNER JOIN subscription_types st ON s.type_id = st.type_id
            WHERE s.user_id = ? 
            AND s.is_active = TRUE 
            AND s.end_date >= CURDATE()
            AND (s.visits_remaining IS NULL OR s.visits_remaining > 0)
            AND (st.category = 'gym' OR st.category = 'combined')
            ORDER BY s.end_date ASC
            LIMIT 1
        `, [userId]);

        if (suitableSubscription.length > 0) {
            await query(`
                UPDATE subscriptions
                SET visits_remaining = CASE 
                    WHEN visits_remaining IS NULL THEN NULL
                    ELSE GREATEST(visits_remaining - 1, 0)
                END,
                is_active = CASE 
                    WHEN visits_remaining IS NULL THEN is_active
                    WHEN GREATEST(visits_remaining - 1, 0) = 0 THEN FALSE
                    ELSE is_active
                END
                WHERE subscription_id = ?
            `, [suitableSubscription[0].subscription_id]);
        }

        res.json({ message: 'Вы успешно записались в зал' });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function cancelBooking(req, res) {
    try {
        const userId = req.user.userId;
        const bookingId = req.params.id;

        const booking = await query('SELECT * FROM bookings WHERE booking_id = ? AND user_id = ?', [bookingId, userId]);
        if (booking.length === 0) {
            return res.status(404).json({ message: 'Запись не найдена' });
        }

        await query('UPDATE bookings SET status = ? WHERE booking_id = ?', ['cancelled', bookingId]);

        res.json({ message: 'Запись отменена' });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function getSessionProgram(req, res) {
    try {
        const scheduleId = req.params.id;
        const schedule = await query('SELECT program_id FROM schedule WHERE schedule_id = ? AND is_cancelled = FALSE', [scheduleId]);
        if (schedule.length === 0 || !schedule[0].program_id) {
            return res.json({ exercises: [] });
        }

        const program = await query('SELECT exercises FROM trainer_programs WHERE program_id = ?', [schedule[0].program_id]);
        if (program.length === 0 || !program[0].exercises) {
            return res.json({ exercises: [] });
        }

        let exercises = [];
        try {
            exercises = typeof program[0].exercises === 'string'
                ? JSON.parse(program[0].exercises)
                : program[0].exercises;
        } catch {
            exercises = [];
        }

        res.json({ exercises });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function getStatistics(req, res) {
    try {
        const userId = req.user.userId;
        const { totalVisits, discountPercent } = await getClientDiscount(userId);

        const monthVisits = await query(`
            SELECT COUNT(*) as count FROM attendance
            WHERE user_id = ? 
            AND MONTH(attendance_date) = MONTH(CURDATE())
            AND YEAR(attendance_date) = YEAR(CURDATE())
        `, [userId]);

        const monthlyAttendance = await query(`
            SELECT 
                DATE_FORMAT(attendance_date, '%Y-%m') as month,
                COUNT(*) as visits
            FROM attendance
            WHERE user_id = ?
            GROUP BY DATE_FORMAT(attendance_date, '%Y-%m')
            ORDER BY month DESC
            LIMIT 6
        `, [userId]);

        const visitsToNextDiscount = 10 - (totalVisits % 10);

        res.json({
            totalVisits,
            monthVisits: monthVisits[0]?.count || 0,
            discountPercent,
            visitsToNextDiscount: visitsToNextDiscount === 10 ? 0 : visitsToNextDiscount,
            monthlyAttendance: monthlyAttendance.map(m => ({
                month: new Date(`${m.month}-01`).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }),
                visits: m.visits
            }))
        });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function getNotifications(req, res) {
    try {
        const userId = req.user.userId;
        const todayBookings = await query(`
            SELECT b.*, s.session_date, s.start_time, s.end_time,
                   u.first_name as trainer_first_name, u.last_name as trainer_last_name
            FROM bookings b
            INNER JOIN schedule s ON b.schedule_id = s.schedule_id
            INNER JOIN users u ON s.trainer_id = u.user_id
            WHERE b.user_id = ? 
            AND b.status = 'booked'
            AND DATE(s.session_date) = CURDATE()
        `, [userId]);

        const notifications = todayBookings.map(booking => ({
            title: 'Тренировка сегодня!',
            message: `У вас тренировка в ${booking.start_time.substring(0, 5)} с ${booking.trainer_first_name} ${booking.trainer_last_name}`,
            is_today: true,
            created_at: new Date().toISOString()
        }));

        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function updateProfile(req, res) {
    try {
        const userId = req.user.userId;
        const { first_name, last_name, email, phone, password } = req.body;

        const nameRegex = /^[A-Za-zА-Яа-яЁё]+$/u;
        const phoneRegex = /^[0-9+\-]+$/;

        if (!nameRegex.test(first_name) || !nameRegex.test(last_name)) {
            return res.status(400).json({ message: 'Имя и фамилия должны содержать только буквы' });
        }

        if (phone && !phoneRegex.test(phone)) {
            return res.status(400).json({ message: 'Номер телефона может содержать только цифры, а также символы + и -' });
        }

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
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

module.exports = {
    getActiveSubscriptions,
    getBookings,
    getSubscriptionTypes,
    purchaseSubscription,
    getAvailableSessions,
    createBooking,
    bookGym,
    cancelBooking,
    getSessionProgram,
    getStatistics,
    getNotifications,
    updateProfile
};

