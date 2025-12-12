const express = require('express');
const publicController = require('../controllers/publicController');

const router = express.Router();

router.get('/schedule', publicController.getSchedule);
router.get('/subscription-types', publicController.getSubscriptionTypes);
router.get('/trainers', publicController.getTrainers);

module.exports = router;