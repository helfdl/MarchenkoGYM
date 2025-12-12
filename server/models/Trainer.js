const { query } = require('../config/database');

function getPublicTrainers() {
    return query(`
        SELECT 
            u.user_id,
            u.first_name,
            u.last_name,
            u.phone,
            u.total_visits,
            COUNT(DISTINCT tp.program_id) as programs_count,
            tpr.specialty,
            tpr.experience_years,
            tpr.bio
        FROM users u
        LEFT JOIN trainer_programs tp ON u.user_id = tp.trainer_id
        LEFT JOIN trainer_profiles tpr ON u.user_id = tpr.trainer_id
        WHERE u.role = 'trainer' 
        AND u.is_active = TRUE
        GROUP BY u.user_id, tpr.specialty, tpr.experience_years, tpr.bio
        ORDER BY u.first_name, u.last_name
    `);
}

function getTrainerClients(trainerId) {
    return query(`
        SELECT DISTINCT u.user_id, u.first_name, u.last_name, u.email, u.phone,
               COUNT(DISTINCT b.booking_id) as bookings_count,
               COUNT(DISTINCT CASE WHEN s.session_type = 'group' THEN b.booking_id END) as group_sessions_count
        FROM users u
        INNER JOIN bookings b ON u.user_id = b.user_id
        INNER JOIN schedule s ON b.schedule_id = s.schedule_id
        WHERE s.trainer_id = ? AND u.role = 'client' AND u.is_active = TRUE
        GROUP BY u.user_id, u.first_name, u.last_name, u.email, u.phone
        ORDER BY u.first_name, u.last_name
    `, [trainerId]);
}

function getTrainerPrograms(trainerId) {
    return query(`
        SELECT * FROM trainer_programs
        WHERE trainer_id = ?
        ORDER BY program_id
    `, [trainerId]);
}

async function getProgramById(programId) {
    const [program] = await query('SELECT * FROM trainer_programs WHERE program_id = ?', [programId]);
    return program;
}

function updateProgramExercises(programId, exercises) {
    return query('UPDATE trainer_programs SET exercises = ? WHERE program_id = ?', [JSON.stringify(exercises), programId]);
}

async function createProgram(trainerId, durationMinutes) {
    const result = await query(
        'INSERT INTO trainer_programs (trainer_id, duration_minutes, exercises) VALUES (?, ?, ?)',
        [trainerId, durationMinutes, JSON.stringify([])]
    );
    return result.insertId;
}

module.exports = {
    getPublicTrainers,
    getTrainerClients,
    getTrainerPrograms,
    getProgramById,
    updateProgramExercises,
    createProgram
};