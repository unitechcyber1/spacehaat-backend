import { Router } from 'express';
const router = Router();
import manageCity from '../../controllers/admin/ManageCity.js';

router.get('/cities', manageCity.getCities)
    .post('/city', manageCity.addOrEditCity)
    .put('/city/:cityId', manageCity.addOrEditCity)
    .get('/city/:id', manageCity.getCityById)
    .get('/city/changeStatus/:cityId', manageCity.toggleCityStatus)
    .get('/city/getCityByCountryState/:stateId', manageCity.getCityByCountryState)
    .get('/city/getCityByCountryOnly/:countryId', manageCity.getCityByCountryOnly)
    .delete('/city/delete/:cityId', manageCity.deleteCity)
    .get('/cities/citiesBySpaceType', manageCity.citiesBySpaceType)


export default router;