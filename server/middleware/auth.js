const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'gym-secret-key-2025';

function requireAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Требуется авторизация' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Неверный токен' });
    }
}

function requireAdmin(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Требуется авторизация' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ message: 'Требуются права администратора' });
        }
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Неверный токен' });
    }
}

function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Требуется авторизация' });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Недостаточно прав' });
        }
        
        next();
    };
}

module.exports = { requireAuth, requireAdmin, requireRole };