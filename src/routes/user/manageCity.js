import express from 'express';
const router = express.Router();
import manageCity from '../../controllers/admin/ManageCity.js';

router.get('/cities', manageCity.getCities)
    .get('/getSpacesByCity/:cityId', manageCity.getSpacesByCity)
    .get('/getByCity_name/:cityId', manageCity.getByCityName)
    .get('/getByCityName1/:cityId', manageCity.getByCityName1)
    .get('/getCityByCountry/:countryId', manageCity.getCityByCountryOnly)
    .get('/getfeaturedImages', manageCity.getfeaturedImages)
    .get('/getbrandAdsImages', manageCity.getBrandAdsImages)
    .get('/getCitiesBySpaceType', manageCity.getCitiesBySpaceType)
    .get('/getActiveCityForAllSpaceTypes',manageCity.getActiveCityForAllSpaceTypes)

export default router;