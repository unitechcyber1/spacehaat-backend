import express from 'express';
const router = express.Router();
import manageCity from '../../controllers/admin/manageCountry.js';

router.get('/country', manageCity.getCountries);
router.post('/countryByDynamic', manageCity.getCountriesBydynamic);
router.get('/getCountryByName/:countryName',manageCity.getCountryByName)
export default router;