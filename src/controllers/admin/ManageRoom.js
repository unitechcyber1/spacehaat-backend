import manageRoomService from '../../services/admin/manage-room.js';

class ManageRoom {
    constructor() {
        return {
            getRooms: this.getRooms.bind(this),
            addOrEditRoom: this.addOrEditRoom.bind(this),
            deleteRoom: this.deleteRoom.bind(this)
        }
    }

    async getRooms(req, res, next) {
        try {
            const data = await manageRoomService.getRooms(req.query);
            return res.status(200).json({
                message: 'Room list',
                data: data.rooms,
                totalRecords: data.count
            });
        } catch (error) {
            next(error)
        }
    }

    async addOrEditRoom(req, res, next) {
        try {
            let room = null;
            let message = 'Room Added';
            if (req.method == 'PUT') {
                const forEdit = Object.assign({}, req.params, req.body);
                room = await manageRoomService.editRoom(forEdit);
                message = 'Room Updated';
            } else {
                room = await manageRoomService.addRoom(req.body);
            }
            res.status(200).json({
                message,
                data: room
            });
        } catch (error) {
            next(error)
        }
    }

    async deleteRoom(req, res, next) {
        try {
            await manageRoomService.deleteRoom(req.params);
            res.status(200).json({
                message: 'Room deleted'
            })
        } catch (error) {
            next(error);
        }
    }
}
export default new ManageRoom();
