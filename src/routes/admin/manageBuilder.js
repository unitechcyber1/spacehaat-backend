import { Router } from 'express';
const router = Router();
import manageBuilder from '../../controllers/admin/ManageBuilder.js';

router.get('/builders', manageBuilder.getBuilders)
    .get('/builders/:builderId', manageBuilder.getBuildersById)
    .post('/builders', manageBuilder.createOrUpdateBuilder)
    .put('/builders/:id', manageBuilder.createOrUpdateBuilder)
    .post('/builders/changeStatus/:builderId', manageBuilder.changeBuilderStatus)
    .delete('/builders/:id', manageBuilder.deleteBuilder)
    .get('/builders/priority/type', manageBuilder.getPriorityBuilders)
    .post('/builders/priority', manageBuilder.addPriorityBuilder)
    .post('/builders/priority/changeOrder', manageBuilder.setPriorityByType)
    .put('/builders/slug/update', manageBuilder.changeSlugById)

export default router;