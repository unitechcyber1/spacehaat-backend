import { Router } from 'express';
const router = Router();
import manageSchedule from '../../controllers/admin/ManageSchedule.js';

router.get('/schedules', manageSchedule.getSchedules)
    .get('/schedule/:id', manageSchedule.getScheduleById)
    .put('/schedule/:id', manageSchedule.updateSchedule)

export default router;