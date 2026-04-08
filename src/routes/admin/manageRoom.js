import { Router } from 'express';
const router = Router();
import manageRoom from '../../controllers/admin/ManageRoom.js';

router.get('/rooms', manageRoom.getRooms)
    .post('/room', manageRoom.addOrEditRoom)
    .put('/room/:roomId', manageRoom.addOrEditRoom)
    .delete('/room/:roomId', manageRoom.deleteRoom)

export default router;
