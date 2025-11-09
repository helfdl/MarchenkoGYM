const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/trainer', require('./routes/trainer'));
app.use('/api/client', require('./routes/client'));
app.use('/api/public', require('./routes/public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/admin/index.html'));
});

app.get('/admin/subscriptions', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/admin/subscriptions.html'));
});

app.get('/admin/schedule', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/admin/schedule.html'));
});

app.get('/admin/accounts-management', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/admin/accounts-management.html'));
});

app.get('/admin/clients-management', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/admin/clients-management.html'));
});

app.get('/admin/reports', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/admin/reports.html'));
});

app.get('/admin/trainer-management', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/admin/trainer-management.html'));
});

app.get('/client', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/client/index.html'));
});

app.get('/trainer', (req, res) => {
    res.sendFile(path.join(__dirname, 'views/trainer/index.html'));
});

app.get('*', (req, res) => {
    res.redirect('/');
});

async function startServer() {
    app.listen(PORT, () => {
        console.log(`Сервер запущен на http://localhost:${PORT}`);
    });
}

startServer();