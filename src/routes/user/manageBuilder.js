import { Router } from 'express';
const router = Router();
import manageBuilder from '../../controllers/user/ManageBuilder.js';

router.get('/builders', manageBuilder.getBuilders)
    .get('/builders/:findKey', manageBuilder.getBuildersById)
    .get('/builders_by_name/:builderId', manageBuilder.getBuildersByName)
    .get('/builder_com_resi_projects', manageBuilder.getBuilderComResiProjects)
    .get('/builder/priority/type', manageBuilder.getPriorityBuilders)


export default router;