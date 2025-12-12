const { query } = require('../config/database');

async function findByEmail(email) {
    return query('SELECT * FROM users WHERE email = ?', [email]);
}

async function findByEmailExcludingId(email, userId) {
    return query('SELECT user_id FROM users WHERE email = ? AND user_id != ?', [email, userId]);
}

async function findById(id) {
    const [user] = await query('SELECT * FROM users WHERE user_id = ?', [id]);
    return user;
}

async function createUser({ email, passwordHash, firstName, lastName, phone, role, isActive = true, discountPercent = 0 }) {
    return query(
        'INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active, discount_percent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [email, passwordHash, firstName, lastName, phone, role, isActive, discountPercent]
    );
}

async function updateUser(userId, payload = {}) {
    const fields = [];
    const values = [];

    Object.entries(payload).forEach(([key, value]) => {
        fields.push(`${key} = ?`);
        values.push(value);
    });

    if (!fields.length) {
        return null;
    }

    values.push(userId);

    return query(`UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`, values);
}

async function deleteUser(userId) {
    return query('DELETE FROM users WHERE user_id = ?', [userId]);
}

function incrementVisits(userId) {
    return query('UPDATE users SET total_visits = total_visits + 1 WHERE user_id = ?', [userId]);
}

function updateDiscount(userId, discount) {
    return query('UPDATE users SET discount_percent = ? WHERE user_id = ?', [discount, userId]);
}

module.exports = {
    findByEmail,
    findByEmailExcludingId,
    findById,
    createUser,
    updateUser,
    deleteUser,
    incrementVisits,
    updateDiscount
};

