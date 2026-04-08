import models from '../../models/index.js';
const Room = models['Room'];

class ManageRoomService {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getRooms: this.getRooms.bind(this),
            addRoom: this.addRoom.bind(this),
            editRoom: this.editRoom.bind(this),
            deleteRoom: this.deleteRoom.bind(this)
        }
    }

    async getRooms({ limit = 10, sortBy = 'name', orderBy = 1, skip, name }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                name = '.*' + name + '.*';
                condition['name'] = { $regex: new RegExp('^' + name + '$', 'i') };
            }
            result.rooms = await Room.find(condition)
                .limit(limit)
                .skip(skip)
                .sort({
                    [sortBy]: orderBy });
            result.count = await Room.countDocuments(condition);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async addRoom({ description, name }) {
        try {
            return await Room.create({ description, name });
        } catch (error) {
            throw error;
        }
    }

    async editRoom({ roomId, name, description, updated_by }) {
        try {
            return await Room.findOneAndUpdate({ _id: roomId }, { name, description, updated_by },
                this.updateOptions);
        } catch (e) {
            throw (e)
        }
    }

    async deleteRoom({ roomId }) {
        try {
            await Room.deleteOne({ _id: roomId });
            return true;
        } catch (error) {
            throw (error)
        }
    }
}

export default new ManageRoomService();