import { Router } from 'express';
const router = Router();
import manageCity from '../../controllers/admin/ManageAdsImage.js';

router.get('/adsImages', manageCity.getCities)
    .post('/adsImage', manageCity.addOrEditCity)
    .put('/adsImage/:cityId', manageCity.addOrEditCity)
    .get('/adsImage/:id', manageCity.getCityById)
    .get('/adsImage/changeStatus/:cityId', manageCity.toggleCityStatus)
    // .get('/city/getCityByCountryState/:stateId',manageCity.getCityByCountryState)
    // .get('/city/getCityByCountryOnly/:countryId',manageCity.getCityByCountryOnly)
    .delete('/adsImage/delete/:cityId', manageCity.deleteCity)
    .post('/adsImage/priority/changeOrder', manageCity.setPriorityByType)



export default router;