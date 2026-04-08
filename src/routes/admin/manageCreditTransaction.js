import express from 'express';
import ManageCreditTransaction from '../../controllers/admin/ManageCreditTransaction.js';
const router = express.Router();

router.get('/creditOrders', ManageCreditTransaction.getCreditsTransaction)
      .delete('/creditOrder/:id', ManageCreditTransaction.deleteOrder)

export default router;
