import { Router } from 'express';
const router = Router();
import manageSubBuilder from '../../controllers/admin/ManageSubBuilder.js';

router.get('/subbuilders', manageSubBuilder.getSubBuilders)
    .get('/subbuilders/:subbuilderId', manageSubBuilder.getSubBuildersById)
    .post('/subbuilders', manageSubBuilder.createOrUpdateBuilder)
    .put('/subbuilders/:id', manageSubBuilder.createOrUpdateBuilder)
    .post('/subbuilders/changeStatus/:subbuilderId', manageSubBuilder.changeSubBuilderStatus)
    .delete('/subbuilders/:id', manageSubBuilder.deleteSubBuilder)
    .post('/subbuilders/priority', manageSubBuilder.addPrioritySubBuilder)
    .post('/subbuilders/priority/changeOrder', manageSubBuilder.setPriorityByType)
    .put('/subbuilders/slug/update', manageSubBuilder.changeSlugById)
    .get('/subbuilders/priority/type', manageSubBuilder.getPriorityBuilders)
    .put('/subbuilders/priority/drag', manageSubBuilder.spaceOrderByDrag)

export default router;