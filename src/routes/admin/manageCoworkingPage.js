import { Router } from 'express';
const router = Router();
import ManageCoworkingPage from '../../controllers/admin/ManageCoworkingPage.js';


router
    .get('/coworkingpage/:workSpaceId', ManageCoworkingPage.getCoworkingPageById)
    .post('/coworkingpage', ManageCoworkingPage.createCoworkingPage)
    .put('/coworkingpage/:id', ManageCoworkingPage.createCoworkingPage)

export default router;