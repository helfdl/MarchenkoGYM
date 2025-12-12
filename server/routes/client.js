const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validateBody } = require('../middleware/validation');
const clientController = require('../controllers/clientController');

const router = express.Router();
const requireClient = [requireAuth, requireRole(['client'])];

router.get('/subscriptions', requireClient, clientController.getActiveSubscriptions);
router.get('/bookings', requireClient, clientController.getBookings);
router.get('/subscription-types', requireClient, clientController.getSubscriptionTypes);
router.post(
    '/subscriptions/purchase',
    [...requireClient, validateBody(['type_id'])],
    clientController.purchaseSubscription
);
router.get('/available-sessions', requireClient, clientController.getAvailableSessions);
router.post(
    '/bookings',
    [...requireClient, validateBody(['schedule_id'])],
    clientController.createBooking
);
router.post(
    '/gym-booking',
    [...requireClient, validateBody(['date', 'time'])],
    clientController.bookGym
);
router.delete('/bookings/:id', requireClient, clientController.cancelBooking);
router.get('/sessions/:id/program', requireClient, clientController.getSessionProgram);
router.get('/statistics', requireClient, clientController.getStatistics);
router.get('/notifications', requireClient, clientController.getNotifications);
router.put('/profile', requireClient, clientController.updateProfile);

module.exports = router;