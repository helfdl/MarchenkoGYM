const bcrypt = require('bcryptjs');
const ScheduleModel = require('../models/Schedule');
const TrainerModel = require('../models/Trainer');
const BookingModel = require('../models/Booking');
const AttendanceModel = require('../models/Attendance');
const UserModel = require('../models/User');

function calculateDiscount(totalVisits = 0) {
    return Math.min(Math.floor(totalVisits / 10) * 10, 20);
}

async function ensureTrainerOwnsSchedule(scheduleId, trainerId) {
    const schedule = await ScheduleModel.getScheduleById(scheduleId);
    if (!schedule || schedule.trainer_id !== trainerId) {
        const error = new Error('Доступ запрещен');
        error.status = 403;
        throw error;
    }
    return schedule;
}

async function getSchedule(req, res) {
    try {
        const trainerId = req.user.userId;
        const { date } = req.query;
        const schedule = await ScheduleModel.getTrainerSchedule(trainerId, date);
        res.json(schedule);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.status ? error.message : 'Ошибка сервера' });
    }
}

async function getClients(req, res) {
    try {
        const trainerId = req.user.userId;
        const clients = await TrainerModel.getTrainerClients(trainerId);
        res.json(clients);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function getPrograms(req, res) {
    try {
        const trainerId = req.user.userId;
        const programs = await TrainerModel.getTrainerPrograms(trainerId);
        res.json(programs);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function getScheduleBookings(req, res) {
    try {
        const trainerId = req.user.userId;
        const scheduleId = req.params.id;
        await ensureTrainerOwnsSchedule(scheduleId, trainerId);

        const bookings = await BookingModel.getScheduleBookings(scheduleId);
        res.json(bookings);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.status ? error.message : 'Ошибка сервера' });
    }
}

async function getClientBookings(req, res) {
    try {
        const trainerId = req.user.userId;
        const clientId = req.params.id;
        const bookings = await BookingModel.getClientBookingsByTrainer(trainerId, clientId);
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function markAttendance(req, res) {
    try {
        const trainerId = req.user.userId;
        const { user_id, schedule_id, booking_id } = req.body;

        await ensureTrainerOwnsSchedule(schedule_id, trainerId);

        if (booking_id) {
            const booking = await BookingModel.findBooking(booking_id, schedule_id, user_id);
            if (booking.length === 0) {
                return res.status(400).json({ message: 'Запись не найдена' });
            }
        }

        const existing = await AttendanceModel.findByUserAndSchedule(user_id, schedule_id);
        if (existing.length > 0) {
            return res.json({ message: 'Посещаемость уже отмечена' });
        }

        await AttendanceModel.createAttendance(user_id, schedule_id, trainerId);

        
        await ScheduleModel.incrementParticipants(schedule_id);

        if (booking_id) {
            await BookingModel.updateBookingStatus(booking_id, 'attended');
        }

        await UserModel.incrementVisits(user_id);
        const updatedUser = await UserModel.findById(user_id);
        if (updatedUser) {
            const discount = calculateDiscount(updatedUser.total_visits || 0);
            await UserModel.updateDiscount(user_id, discount);
        }

        res.json({ message: 'Посещаемость отмечена' });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.status ? error.message : 'Ошибка сервера' });
    }
}

async function removeAttendance(req, res) {
    try {
        const trainerId = req.user.userId;
        const { user_id, schedule_id, booking_id } = req.body;

        await ensureTrainerOwnsSchedule(schedule_id, trainerId);

        await AttendanceModel.deleteAttendance(user_id, schedule_id);

        
        await ScheduleModel.decrementParticipants(schedule_id);

        if (booking_id) {
            await BookingModel.updateBookingStatus(booking_id, 'booked');
        }

        res.json({ message: 'Посещаемость снята' });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.status ? error.message : 'Ошибка сервера' });
    }
}

async function getAttendanceStats(req, res) {
    try {
        const trainerId = req.user.userId;
        const [stats] = await AttendanceModel.getTrainerAttendanceStats(trainerId);
        res.json(stats || {
            total_sessions: 0,
            attended_sessions: 0,
            unique_clients: 0,
            attendance_rate: 0,
            group_sessions: 0,
            group_attendance: 0,
            individual_sessions: 0,
            individual_attendance: 0
        });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function getDashboardStats(req, res) {
    try {
        const trainerId = req.user.userId;
        const [stats] = await AttendanceModel.getTrainerDashboardStats(trainerId);
        res.json(stats || { totalSessions: 0, totalClients: 0, todaySessions: 0, totalVisits: 0, attendanceRate: 0 });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

async function getScheduleExercises(req, res) {
    try {
        const trainerId = req.user.userId;
        const scheduleId = req.params.id;
        const schedule = await ensureTrainerOwnsSchedule(scheduleId, trainerId);

        if (!schedule.program_id) {
            return res.json([]);
        }

        const program = await TrainerModel.getProgramById(schedule.program_id);
        if (!program || !program.exercises) {
            return res.json([]);
        }

        let exercises = [];
        try {
            exercises = typeof program.exercises === 'string'
                ? JSON.parse(program.exercises)
                : program.exercises;
        } catch {
            exercises = [];
        }

        res.json(exercises || []);
    } catch (error) {
        res.status(error.status || 500).json({ message: error.status ? error.message : 'Ошибка сервера' });
    }
}

async function addScheduleExercise(req, res) {
    try {
        const trainerId = req.user.userId;
        const scheduleId = req.params.id;
        const { program_id, exercise_name, duration_minutes } = req.body;

        if (!exercise_name || !duration_minutes || duration_minutes <= 0) {
            return res.status(400).json({ message: 'Необходимо указать название и длительность упражнения' });
        }

        const schedule = await ensureTrainerOwnsSchedule(scheduleId, trainerId);

        const startTime = new Date(`2000-01-01T${schedule.start_time}`);
        const endTime = new Date(`2000-01-01T${schedule.end_time}`);
        const sessionDuration = Math.round((endTime - startTime) / (1000 * 60));

        let targetProgramId = program_id || schedule.program_id;
        
        
        if (!targetProgramId) {
            const { query } = require('../config/database');
            
            targetProgramId = await TrainerModel.createProgram(trainerId, sessionDuration);
            
            
            await query(
                'UPDATE schedule SET program_id = ? WHERE schedule_id = ?',
                [targetProgramId, scheduleId]
            );
        }

        const program = await TrainerModel.getProgramById(targetProgramId);
        if (!program || program.trainer_id !== trainerId) {
            return res.status(403).json({ message: 'Доступ запрещен' });
        }

        let exercises = [];
        if (program.exercises) {
            try {
                exercises = typeof program.exercises === 'string'
                    ? JSON.parse(program.exercises)
                    : program.exercises;
            } catch {
                exercises = [];
            }
        }

        const totalCurrentDuration = exercises.reduce((sum, ex) => sum + (ex.duration_minutes || 0), 0);
        const newTotalDuration = totalCurrentDuration + duration_minutes;

        if (newTotalDuration > sessionDuration) {
            return res.status(400).json({
                message: `Общая длительность упражнений (${newTotalDuration} мин) не может превышать длительность тренировки (${sessionDuration} мин)`
            });
        }

        exercises.push({
            exercise_name,
            duration_minutes,
            order_index: exercises.length
        });

        await TrainerModel.updateProgramExercises(targetProgramId, exercises);

        res.json({ message: 'Упражнение добавлено', exercises });
    } catch (error) {
        res.status(error.status || 500).json({ message: error.status ? error.message : 'Ошибка сервера' });
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

        const existingUser = await UserModel.findByEmailExcludingId(email, userId);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
        }

        const payload = {
            first_name,
            last_name,
            email,
            phone
        };

        if (password) {
            payload.password_hash = await bcrypt.hash(password, 10);
        }

        await UserModel.updateUser(userId, payload);

        res.json({ message: 'Профиль успешно обновлен' });
    } catch (error) {
        res.status(500).json({ message: 'Ошибка сервера' });
    }
}

module.exports = {
    getSchedule,
    getClients,
    getPrograms,
    getScheduleBookings,
    getClientBookings,
    markAttendance,
    removeAttendance,
    getAttendanceStats,
    getDashboardStats,
    getScheduleExercises,
    addScheduleExercise,
    updateProfile
};

