const { query } = require('../config/database');

function findByUserAndSchedule(userId, scheduleId) {
    return query('SELECT attendance_id FROM attendance WHERE user_id = ? AND schedule_id = ?', [userId, scheduleId]);
}

function createAttendance(userId, scheduleId, trainerId) {
    return query('INSERT INTO attendance (user_id, schedule_id, marked_by_trainer_id) VALUES (?, ?, ?)', [userId, scheduleId, trainerId]);
}

function deleteAttendance(userId, scheduleId) {
    return query('DELETE FROM attendance WHERE user_id = ? AND schedule_id = ?', [userId, scheduleId]);
}

function getTrainerAttendanceStats(trainerId) {
    return query(`
        SELECT 
            COUNT(DISTINCT s.schedule_id) as total_sessions,
            COUNT(DISTINCT a.attendance_id) as attended_sessions,
            COUNT(DISTINCT a.user_id) as unique_clients,
            CASE 
                WHEN COUNT(DISTINCT s.schedule_id) > 0 
                THEN (COUNT(DISTINCT a.attendance_id) * 100.0 / COUNT(DISTINCT s.schedule_id))
                ELSE 0 
            END as attendance_rate,
            COUNT(DISTINCT CASE WHEN s.session_type = 'group' THEN s.schedule_id END) as group_sessions,
            COUNT(DISTINCT CASE WHEN s.session_type = 'group' THEN a.attendance_id END) as group_attendance,
            COUNT(DISTINCT CASE WHEN s.session_type = 'individual' THEN s.schedule_id END) as individual_sessions,
            COUNT(DISTINCT CASE WHEN s.session_type = 'individual' THEN a.attendance_id END) as individual_attendance
        FROM schedule s
        LEFT JOIN attendance a ON s.schedule_id = a.schedule_id
        WHERE s.trainer_id = ? AND s.is_cancelled = FALSE
    `, [trainerId]);
}

function getTrainerDashboardStats(trainerId) {
    return query(`
        SELECT 
            COUNT(DISTINCT s.schedule_id) as totalSessions,
            COUNT(DISTINCT b.user_id) as totalClients,
            COUNT(DISTINCT CASE WHEN DATE(s.session_date) = CURDATE() THEN s.schedule_id END) as todaySessions,
            COUNT(DISTINCT a.attendance_id) as totalVisits,
            CASE 
                WHEN COUNT(DISTINCT s.schedule_id) > 0 
                THEN (COUNT(DISTINCT a.attendance_id) * 100.0 / COUNT(DISTINCT s.schedule_id))
                ELSE 0 
            END as attendanceRate
        FROM schedule s
        LEFT JOIN bookings b ON s.schedule_id = b.schedule_id AND b.status = 'booked'
        LEFT JOIN attendance a ON s.schedule_id = a.schedule_id
        WHERE s.trainer_id = ? AND s.is_cancelled = FALSE
    `, [trainerId]);
}

module.exports = {
    findByUserAndSchedule,
    createAttendance,
    deleteAttendance,
    getTrainerAttendanceStats,
    getTrainerDashboardStats
};

