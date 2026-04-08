import { Router } from 'express';
const router = Router();
import manageCity from '../../controllers/admin/ManageFeaturedSpace.js';

router.get('/featuredImages', manageCity.getCities)
    .post('/featuredImage', manageCity.addOrEditCity)
    .put('/featuredImage/:cityId', manageCity.addOrEditCity)
    .get('/featuredImage/:id', manageCity.getCityById)
    .get('/featuredImage/changeStatus/:cityId', manageCity.toggleCityStatus)
    // .get('/city/getCityByCountryState/:stateId',manageCity.getCityByCountryState)
    // .get('/city/getCityByCountryOnly/:countryId',manageCity.getCityByCountryOnly)
    .delete('/featuredImage/delete/:cityId', manageCity.deleteCity)


export default router;
