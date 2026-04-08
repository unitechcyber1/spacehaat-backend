import express from 'express';
const router = express.Router();
import ManageCreditUsage from '../../controllers/user/ManageCreditUsage.js';

router.post('/create/creditUse', ManageCreditUsage.createCreditUsage)

export default router;