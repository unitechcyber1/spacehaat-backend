import express from 'express';

import ManageBuildingController from '../../controllers/user/ManageBuilding.js';

const router = express.Router();

router
    .get('/buildings', ManageBuildingController.getBuildings)
    .get('/building/:slug', ManageBuildingController.getBuildingBySlug);

export default router;
