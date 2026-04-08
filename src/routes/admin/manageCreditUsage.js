import express from 'express';
const router = express.Router();
import ManageCreditUsage from '../../controllers/admin/ManageCreditUsage.js';

router.get('/creditUsage', ManageCreditUsage.getCreditUsage)

export default router;  