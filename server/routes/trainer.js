const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const trainerController = require('../controllers/trainerController');

const router = express.Router();

router.get('/schedule', requireAuth, requireRole(['trainer']), trainerController.getSchedule);
router.get('/clients', requireAuth, requireRole(['trainer']), trainerController.getClients);
router.get('/programs', requireAuth, requireRole(['trainer']), trainerController.getPrograms);
router.get('/schedule/:id/bookings', requireAuth, requireRole(['trainer']), trainerController.getScheduleBookings);
router.get('/clients/:id/bookings', requireAuth, requireRole(['trainer']), trainerController.getClientBookings);
router.post('/attendance', requireAuth, requireRole(['trainer']), trainerController.markAttendance);
router.delete('/attendance', requireAuth, requireRole(['trainer']), trainerController.removeAttendance);
router.get('/attendance/stats', requireAuth, requireRole(['trainer']), trainerController.getAttendanceStats);
router.get('/dashboard-stats', requireAuth, requireRole(['trainer']), trainerController.getDashboardStats);
router.get('/schedule/:id/exercises', requireAuth, requireRole(['trainer']), trainerController.getScheduleExercises);
router.post('/schedule/:id/exercises', requireAuth, requireRole(['trainer']), trainerController.addScheduleExercise);
router.put('/profile', requireAuth, requireRole(['trainer']), trainerController.updateProfile);

module.exports = router;