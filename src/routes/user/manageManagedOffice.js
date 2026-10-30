import express from 'express';

import ManageManagedOfficeController from '../../controllers/user/ManageManagedOffice.js';

const router = express.Router();

router
    .get('/managedOffices', ManageManagedOfficeController.getManagedOffices)
    .get('/managedOffice/:findKey', ManageManagedOfficeController.getManagedOfficeByIdOrSlug);

export default router;
