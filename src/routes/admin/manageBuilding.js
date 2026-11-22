import { Router } from 'express';
import manageBuilding from '../../controllers/admin/ManageBuilding.js';

const router = Router();

router.get('/buildings', manageBuilding.getBuildings)
    .get('/building/:buildingId', manageBuilding.getBuilding)
    .post('/building', manageBuilding.addOrEditBuilding)
    .put('/building/:buildingId', manageBuilding.addOrEditBuilding)
    .delete('/building/:buildingId', manageBuilding.deleteBuilding)
    .get('/building-centres/search', manageBuilding.searchCentres)
    .get('/building-centre/:type/:id', manageBuilding.getCentreBuilding)
    .put('/building-centre', manageBuilding.setCentreBuilding);

export default router;
