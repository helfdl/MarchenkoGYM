const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_PATH = path.join(__dirname, '../client');

app.use(express.json());
app.use(express.static(CLIENT_PATH));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/trainer', require('./routes/trainer'));
app.use('/api/client', require('./routes/client'));
app.use('/api/public', require('./routes/public'));

app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    res.sendFile(path.join(CLIENT_PATH, 'index.html'));
});

async function startServer() {
    app.listen(PORT, () => {
        console.log(`Сервер запущен на http://localhost:${PORT}`);
    });
}

startServer();