import { Router } from 'express';
const router = Router();
import manageCity from '../../controllers/admin/ManageMedia.js';

router.get('/medias', manageCity.getCities)
    .post('/media', manageCity.addOrEditCity)
    .put('/media/:cityId', manageCity.addOrEditCity)
    .get('/media/:id', manageCity.getCityById)
    .get('/media/changeStatus/:cityId', manageCity.toggleCityStatus)
    .post('/media/delete/:cityId', manageCity.deleteCity)


export default router;