const { query } = require('../config/database');

function getActiveTypes() {
    return query(`
        SELECT 
            type_id,
            name,
            category,
            duration_months,
            visits_count,
            base_price,
            final_price,
            description,
            is_active
        FROM subscription_types
        WHERE is_active = TRUE
        ORDER BY category, final_price
    `);
}

module.exports = {
    getActiveTypes
};

