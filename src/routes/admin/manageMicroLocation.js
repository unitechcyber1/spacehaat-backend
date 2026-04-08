import { Router } from 'express';
const router = Router();
import manageMicroLocation from '../../controllers/admin/ManageMicroLocation.js';

router.get('/microLocations', manageMicroLocation.getMicroLocations)
    .post('/microLocation', manageMicroLocation.addOrEditMicroLocation)
    .put('/microLocation/:microLocationId', manageMicroLocation.addOrEditMicroLocation)
    .get('/microLocation/:id', manageMicroLocation.getMicroLocationById)
    .get('/microLocationByCity/:cityId', manageMicroLocation.getMicroLocationByCity)
    .get('/microLocation/changeStatus/:microLocationId', manageMicroLocation.toggleMicroLocationStatus)
    .delete('/microLocation/delete/:microLocationId', manageMicroLocation.deleteMicroLocation)
    .get('/microLocationByCityAndSpaceType', manageMicroLocation.microLocationByCityAndSpaceType)
    .post('/microLocation/priority', manageMicroLocation.addPriorityMicrolocations)
    .post('/microLocation/priority/changeOrder', manageMicroLocation.setPriorityByType)
    .get('/microLocation/priority/type', manageMicroLocation.getPriorityMicrolocations)
    .put('/microLocation/priority/drag', manageMicroLocation.locationOrderByDrag)


export default router;