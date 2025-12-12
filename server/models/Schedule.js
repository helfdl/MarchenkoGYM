const { query } = require('../config/database');

function getPublicSchedule() {
    return query(`
        SELECT 
            s.schedule_id,
            s.session_type,
            DATE_FORMAT(s.session_date, '%Y-%m-%d') as session_date,
            s.start_time,
            s.end_time,
            s.max_participants,
            s.is_cancelled,
            s.name,
            u.first_name as trainer_first_name,
            u.last_name as trainer_last_name,
            (SELECT COUNT(*) FROM bookings b WHERE b.schedule_id = s.schedule_id AND b.status = 'booked') as current_participants
        FROM schedule s
        LEFT JOIN users u ON s.trainer_id = u.user_id
        LEFT JOIN trainer_programs tp ON s.program_id = tp.program_id
        AND (u.is_active IS NULL OR u.is_active = TRUE)
        AND s.is_cancelled = FALSE
        ORDER BY s.session_date, s.start_time
    `);
}

function getTrainerSchedule(trainerId, date) {
    let sql = `
        SELECT 
            s.schedule_id,
            s.trainer_id,
            s.program_id,
            s.name,
            s.session_type,
            DATE_FORMAT(s.session_date, '%Y-%m-%d') as session_date,
            s.start_time,
            s.end_time,
            s.max_participants,
            s.current_participants,
            s.is_cancelled
        FROM schedule s
        LEFT JOIN trainer_programs tp ON s.program_id = tp.program_id
        WHERE s.trainer_id = ? AND s.is_cancelled = FALSE
    `;
    const params = [trainerId];

    if (date) {
        sql += ' AND DATE(s.session_date) = ?';
        params.push(date);
    }

    sql += ' ORDER BY s.session_date, s.start_time';

    return query(sql, params);
}

async function getScheduleById(scheduleId) {
    const [result] = await query('SELECT * FROM schedule WHERE schedule_id = ?', [scheduleId]);
    return result;
}

function incrementParticipants(scheduleId) {
    return query('UPDATE schedule SET current_participants = COALESCE(current_participants, 0) + 1 WHERE schedule_id = ?', [scheduleId]);
}

function decrementParticipants(scheduleId) {
    return query('UPDATE schedule SET current_participants = GREATEST(COALESCE(current_participants, 0) - 1, 0) WHERE schedule_id = ?', [scheduleId]);
}

module.exports = {
    getPublicSchedule,
    getTrainerSchedule,
    getScheduleById,
    incrementParticipants,
    decrementParticipants
};


