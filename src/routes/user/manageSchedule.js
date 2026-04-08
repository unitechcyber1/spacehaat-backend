
import express from 'express';
const router = express.Router();
import ScheduleController from '../../controllers/user/ManageSchedule.js';

router.post('/schedule', ScheduleController.createSchedule)
    .get('/schedules', ScheduleController.getSchedules)
    .get('/schedule/:id', ScheduleController.getScheduleById)

export default router;