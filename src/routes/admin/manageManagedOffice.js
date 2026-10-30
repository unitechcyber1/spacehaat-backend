import { Router } from 'express';

import manageManagedOffice from '../../controllers/admin/ManageManagedOffice.js';

const router = Router();

router
    .get('/managedOffices', manageManagedOffice.getManagedOffices)
    .get('/managedOffices/brands', manageManagedOffice.getManagedOfficeBrands)
    .put('/managedOffices/slug/update', manageManagedOffice.changeSlugById)
    .get('/managedOffice/:managedOfficeId', manageManagedOffice.getManagedOfficeById)
    .post('/managedOffice', manageManagedOffice.createOrUpdateManagedOffice)
    .put('/managedOffice/:id', manageManagedOffice.createOrUpdateManagedOffice)
    .post('/managedOffice/changeStatus/:managedOfficeId', manageManagedOffice.changeManagedOfficeStatus)
    .delete('/managedOffice/:id', manageManagedOffice.deleteManagedOffice);

export default router;
