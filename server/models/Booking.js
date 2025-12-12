const { query } = require('../config/database');

function getScheduleBookings(scheduleId) {
    return query(`
        SELECT b.*, u.first_name, u.last_name, u.email,
               s.session_date, s.start_time, s.end_time, s.session_type, s.max_participants,
               s.name,
               s.current_participants,
               CASE WHEN a.attendance_id IS NOT NULL THEN 'attended' ELSE b.status END as attendance_status
        FROM bookings b
        INNER JOIN users u ON b.user_id = u.user_id
        INNER JOIN schedule s ON b.schedule_id = s.schedule_id
        LEFT JOIN trainer_programs tp ON s.program_id = tp.program_id
        LEFT JOIN attendance a ON b.user_id = a.user_id AND b.schedule_id = a.schedule_id
        WHERE b.schedule_id = ?
        ORDER BY u.first_name, u.last_name
    `, [scheduleId]);
}

function getClientBookingsByTrainer(trainerId, clientId) {
    return query(`
        SELECT b.*, s.session_date, s.start_time, s.end_time, s.session_type, s.max_participants,
               s.name,
               (SELECT COUNT(*) FROM bookings b2 WHERE b2.schedule_id = s.schedule_id AND b2.status = 'booked') as current_participants
        FROM bookings b
        INNER JOIN schedule s ON b.schedule_id = s.schedule_id
        LEFT JOIN trainer_programs tp ON s.program_id = tp.program_id
        WHERE s.trainer_id = ? AND b.user_id = ?
        ORDER BY s.session_date DESC, s.start_time DESC
    `, [trainerId, clientId]);
}

function findBooking(bookingId, scheduleId, userId) {
    return query('SELECT booking_id FROM bookings WHERE booking_id = ? AND schedule_id = ? AND user_id = ?', [bookingId, scheduleId, userId]);
}

function updateBookingStatus(bookingId, status) {
    return query('UPDATE bookings SET status = ? WHERE booking_id = ?', [status, bookingId]);
}

function deleteBookingById(bookingId) {
    return query('DELETE FROM bookings WHERE booking_id = ?', [bookingId]);
}

module.exports = {
    getScheduleBookings,
    getClientBookingsByTrainer,
    findBooking,
    updateBookingStatus,
    deleteBookingById
};

