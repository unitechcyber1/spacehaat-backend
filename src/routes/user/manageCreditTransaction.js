import express from 'express';
import ManageCreditTransaction from '../../controllers/user/ManageCreditTransaction.js';
const router = express.Router();

router.post('/creditsOrder', ManageCreditTransaction.createCreditsTransaction)
      .post('/capturePayment', ManageCreditTransaction.capturedPayment)

      
      export default router;
