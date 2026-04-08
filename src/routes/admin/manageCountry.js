import { Router } from 'express';
const router = Router();
import manageCountry from '../../controllers/admin/manageCountry.js';

router
    .get('/countries', manageCountry.getCountries)
    .post('/country', manageCountry.addOrEditCountry)
    .put('/country/:countryId', manageCountry.addOrEditCountry)
    .get('/country/:id', manageCountry.getCountryById)
    .get('/country/changeStatus/:countryId', manageCountry.toggleCountryStatus)
    .delete('/country/delete/:cityId', manageCountry.deleteCountry)

export default router;
