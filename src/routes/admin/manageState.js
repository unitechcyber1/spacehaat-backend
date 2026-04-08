import { Router } from 'express';
const router = Router();
import ManageState from '../../controllers/admin/ManageState.js';

router.get('/states', ManageState.getStates)
    .post('/state', ManageState.addOrEditState)
    .put('/state/:stateId', ManageState.addOrEditState)
    .get('/state/:id', ManageState.getStateById)
    .delete('/state/delete/:cityId', ManageState.deleteState)
    .get('/stateByCountry/:countryId', ManageState.getStateByCountry)
    .get('/state/changeStatus/:stateId', ManageState.toggleStateStatus)

export default router;
