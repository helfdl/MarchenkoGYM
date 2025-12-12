const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { trainerPhotoUpload } = require('../middleware/upload');
const { validateBody } = require('../middleware/validation');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.get('/dashboard-stats', requireAdmin, adminController.getDashboardStats);
router.get('/recent-activities', requireAdmin, adminController.getRecentActivities);

router.get('/subscription-types', requireAdmin, adminController.getSubscriptionTypes);
router.get('/subscription-types/:id', requireAdmin, adminController.getSubscriptionTypeById);
router.post(
    '/subscription-types',
    [requireAdmin, validateBody(['name', 'category', 'base_price'])],
    adminController.createSubscriptionType
);
router.put('/subscription-types/:id', requireAdmin, adminController.updateSubscriptionType);
router.delete('/subscription-types/:id', requireAdmin, adminController.deactivateSubscriptionType);

router.get('/schedule', adminController.getSchedule);
router.post('/schedule', requireAdmin, adminController.createSchedule);
router.put('/schedule/:id', requireAdmin, adminController.updateSchedule);
router.delete('/schedule/:id', requireAdmin, adminController.deleteSchedule);
router.post('/schedule/:id/cancel', requireAdmin, adminController.cancelSchedule);

router.get('/analytics/attendance', requireAdmin, adminController.getAttendanceAnalytics);
router.get('/analytics/revenue', requireAdmin, adminController.getRevenueAnalytics);
router.get('/analytics/subscription-sales', requireAdmin, adminController.getSubscriptionSalesAnalytics);
router.get('/analytics/trainer-stats', requireAdmin, adminController.getTrainerStats);

router.put('/users/:id/status', requireAdmin, adminController.updateUserStatus);

router.get('/pending-trainers', requireAdmin, adminController.getPendingTrainers);
router.post(
    '/approve-trainer/:id',
    [requireAdmin, trainerPhotoUpload.single('photo')],
    adminController.approveTrainer
);
router.delete('/reject-trainer/:id', requireAdmin, adminController.rejectTrainer);

router.get('/trainers', adminController.getTrainers);
router.get('/trainers/:id/profile', requireAdmin, adminController.getTrainerProfile);
router.put(
    '/trainers/:id/profile',
    [requireAdmin, trainerPhotoUpload.single('photo')],
    adminController.updateTrainerProfile
);
router.post(
    '/trainers',
    [requireAdmin, validateBody(['firstName', 'lastName', 'email', 'phone', 'password'])],
    adminController.createTrainer
);

router.get('/clients', requireAdmin, adminController.getClients);
router.get('/clients/stats', requireAdmin, adminController.getClientStats);
router.get('/clients/:id', requireAdmin, adminController.getClientById);
router.post(
    '/clients',
    [requireAdmin, validateBody(['first_name', 'last_name', 'email', 'phone', 'password'])],
    adminController.createClient
);
router.put('/clients/:id', requireAdmin, adminController.updateClient);
router.delete('/clients/:id', requireAdmin, adminController.deleteClient);
router.get('/clients/:id/subscriptions', requireAdmin, adminController.getClientSubscriptions);

router.get('/accounts', requireAdmin, adminController.getAccounts);
router.get('/accounts/:id', requireAdmin, adminController.getAccountById);
router.post(
    '/accounts',
    [requireAdmin, validateBody(['first_name', 'last_name', 'email', 'phone', 'role', 'password'])],
    adminController.createAccount
);
router.put('/accounts/:id', requireAdmin, adminController.updateAccount);
router.delete('/accounts/:id', requireAdmin, adminController.deleteAccount);

router.get('/active-subscriptions', requireAdmin, adminController.getActiveSubscriptions);
router.get('/active-subscriptions-old', requireAdmin, adminController.getLegacyActiveSubscriptions);

router.get('/reports/summary', requireAdmin, adminController.getReportsSummary);
router.get('/reports/subscription-revenue', requireAdmin, adminController.getSubscriptionRevenueReport);
router.get('/reports/category-stats', requireAdmin, adminController.getCategoryStatsReport);

module.exports = router;