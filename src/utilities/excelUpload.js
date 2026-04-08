import models from '../models/index.js';
import xlsx from 'xlsx';
import fs from 'fs';
import crypto from 'crypto';
const WorkSpace = models['WorkSpace'];
const Room = models['Room'];
const Amenty = models['Amenty'];
const Brand = models['Brand'];
const City = models['City'];
const OfficeSpace = models['OfficeSpace'];

class ManageExcelUpload {
    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            fileProcessing: this.fileProcessing.bind(this)
        }
    }

    async fileProcessing(file, type = 'work_space') {
        try {
            const wb = xlsx.readFile(file.path_local);
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = xlsx.utils.sheet_to_csv(ws);
            const fileData = data.toString();
            let data1 = fileData.split('\n');
            const fileRows = data1.slice(1);
            if (type == 'work_space') {
                await this.uploadBulkWorkSpace(fileRows);
            } else {
                await this.uploadBulkOfficeSpace(fileRows);
            }
            fs.unlink(file.path_local, () => { });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    async uploadBulkWorkSpace(fileRows) {
        try {
            for (let i = 0; i < fileRows.length; i++) {
                let item = fileRows[i];
                if (item.trim()) {
                    const row = item.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                    if (row[0] === '') {
                        break;
                    }
                    const workSpaceRow = {
                        name: row[0].trim(),
                        location: {
                            name: row[1].trim(),
                            address1: row[2].replace(/"/g, '').trim(),
                            city: await this._createCity(row[27] && row[27].trim()),
                            landmark: row[3].trim(),
                            landmark_distance: Number(row[4])
                        },
                        geometry: this._setGeoLocation({ latitude: 28.549670700000004, longitude: 77.21564350000001 }),
                        no_of_seats: Number(row[5].trim()) || 0,
                        plans: this._creatingPlans(row),
                        hours_of_operation: this._creatingHoursOfOperations(row),
                        amenties: await this._creatingAmenties(row),
                        rooms: await this._creatingRooms(row),
                        brand: await this._createBand(),
                        slug: await this._createSlug(row[0].trim(), row[1].trim())
                    }
                    await WorkSpace.findOneAndUpdate(
                        {
                            'name': workSpaceRow.name,
                            'location.address1': workSpaceRow.location.address1
                        },
                        workSpaceRow,
                        this.updateOptions
                    );
                }
            }
            return true;
        } catch (error) {
            throw (error)
        }
    }

    async uploadBulkOfficeSpace(fileRows) {
        try {
            for (let i = 0; i < fileRows.length; i++) {
                let item = fileRows[i];
                if (item.trim()) {
                    const row = item.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                    if (row[0] === '') {
                        break;
                    }
                    const officeSpaceRow = {
                        name: row[21].trim(),
                        slug: await this._createSlug(row[0].trim(), row[1].trim(), 'office_space'),
                        location: {
                            name: row[1].trim(),
                            address: row[3].replace(/"/g, '').trim(),
                            city: await this._createCity(row[20] && row[20].trim()),
                            floor: row[4].trim() || 0,
                            property_id: row[0].trim(),
                            metro_detail: {
                                name: row[8].trim(),
                                distance: row[9].trim(),
                                is_near_metro: row[10].trim().toLocaleLowerCase() == 'no' ? false : true,
                            }
                        },
                        geometry: this._setGeoLocation({ latitude: 28.549670700000004, longitude: 77.21564350000001 }),
                        hours_of_operation: {
                            is_sunday_open: row[11].trim().toLocaleLowerCase() == 'no' ? false : true,
                            is_open_24: row[12].trim().toLocaleLowerCase() == 'no' ? false : true,
                        },
                        other_detail: {
                            building_name: row[2].trim(),
                            how_to_reach: row[7].trim(),
                            area_for_lease_in_sq_ft: row[5].trim(),
                            rent_in_sq_ft: row[6].trim(),
                            facilities: this._createFacilitiesForOffice(row[19].trim())
                        },
                        amenties: await this._creatingAmentiesForOffice(row),

                    }
                    await OfficeSpace.findOneAndUpdate(
                        {
                            'name': officeSpaceRow.name,
                            'location.address': officeSpaceRow.location.address,
                            'location.property_id': officeSpaceRow.location.property_id
                        },
                        officeSpaceRow,
                        this.updateOptions
                    );
                }
            }
            return true;
        } catch (error) {
            throw (error)
        }
    }

    async _createSlug(name, location, schema = 'work_space') {
        try {
            let slugName = `${name} ${location}`;
            slugName = slugName.toString().toLowerCase()
                .replace(/\s+/g, '-')        // Replace spaces with -
                .replace(/[^\w\-]+/g, '')   // Remove all non-word chars
                .replace(/\-\-+/g, '-')      // Replace multiple - with single -
                .replace(/^-+/, '')          // Trim - from start of text
                .replace(/-+$/, '');         // Trim - from end of text
            let data = null;
            if (schema == 'work_space') {
                data = await WorkSpace.findOne({ slug: slugName });
            } else {
                data = await OfficeSpace.findOne({ slug: slugName });
            }
            if (data) {
                slugName = data.slug + '-' + crypto.randomBytes(2).toString('hex');
            }
            return slugName;
        } catch (error) {
            throw (error);
        }
    }

    /** default lat long is used of Cyber Park Sector 67, Gurugram, Haryana 122005 */
    _setGeoLocation({ latitude = 28.549670700000004, longitude = 77.21564350000001 }) {
        return {
            type: 'Point',
            coordinates: [+longitude, +latitude]
        }
    }

    async _createBand() {
        try {
            const brand = await Brand.findOneAndUpdate(
                { name: 'others' },
                { name: 'others' },
                this.updateOptions);
            return brand._id;
        } catch (error) {
            throw (error)
        }
    }

    async _createCity(name = 'Gurugram') {
        try {
            const city = await City.findOneAndUpdate(
                { name },
                { name },
                this.updateOptions);
            return city._id;
        } catch (error) {
            throw (error)
        }
    }

    _creatingHoursOfOperations(row) {
        try {
            const timing = row[11] && row[11].trim().split('to');
            const sundayTiming = row[12] && row[12].trim().split('to');
            let from, to, is_open_24, sFrom, sTo, sIs_open_24, is_closed = null;
            is_open_24 = false;
            if (timing.length > 1) {
                from = timing[0].trim();
                to = timing[1].trim();
            } else {
                is_open_24 = true;
            }
            if (sundayTiming.length > 1) {
                sFrom = sundayTiming[0];
                sTo = sundayTiming[1];
            } else if (sundayTiming[0].toLowerCase() === 'closed') {
                is_closed = true
            } else {
                sIs_open_24 = true
            }
            return {
                monday: { from, to, is_open_24 },
                tuesday: { from, to, is_open_24 },
                wednesday: { from, to, is_open_24 },
                thursday: { from, to, is_open_24 },
                friday: { from, to, is_open_24 },
                saturday: { from, to, is_open_24 },
                sunday: { from: sFrom, to: sTo, is_open_24: sIs_open_24, is_closed },
            }
        } catch (error) {
            throw (error)
        }
    }

    async _creatingAmenties(row) {
        try {
            let amenties = [];
            if (row[13].trim().toLowerCase() === 'yes') {
                const car = await this.callingAmentyModel('Car Parking', 'facilities');
                amenties.push(car._id)
            }
            if (row[14].trim().toLowerCase() === 'yes') {
                const bike = await this.callingAmentyModel('Bike Parking', 'facilities');
                amenties.push(bike._id)
            }
            if (row[15].trim().toLowerCase() === 'yes') {
                const recreational = await this.callingAmentyModel('Recreational Facilities', 'recreational');
                amenties.push(recreational._id)
            }
            return amenties;
        } catch (error) {
            throw (error)
        }
    }

    async callingAmentyModel(name, category) {
        try {
            return await Amenty.findOneAndUpdate(
                { name },
                { category },
                this.updateOptions);
        } catch (error) {
            throw (error)
        }
    }

    async _creatingAmentiesForOffice(row) {
        try {
            let amenties = [];
            if (row[13].trim().toLowerCase() === 'yes') {
                const car = await this.callingAmentyModel('Car Parking', 'facilities');
                amenties.push(car._id);
            }
            if (row[14].trim().toLowerCase() === 'yes') {
                const bike = await this.callingAmentyModel('Bike Parking', 'facilities');
                amenties.push(bike._id);
            }
            if (row[15].trim().toLowerCase() === 'yes') {
                const data = await this.callingAmentyModel('Fully Furnished', 'facilities');
                amenties.push(data._id);
            }
            if (row[16].trim().toLowerCase() === 'yes') {
                const data = await this.callingAmentyModel('Power Backup', 'facilities');
                amenties.push(data._id);
            }
            if (row[17].trim().toLowerCase() === 'yes') {
                const data = await this.callingAmentyModel('Air-Conditioning', 'facilities');
                amenties.push(data._id);
            }
            if (row[18].trim().toLowerCase() === 'yes') {
                const data = await this.callingAmentyModel('Lift', 'facilities');
                amenties.push(data._id);
            }
            if (row[22].trim().toLowerCase() === 'yes') {
                const data = await this.callingAmentyModel('Deposit', 'facilities');
                amenties.push(data._id);
            }
            return amenties;
        } catch (error) {
            throw (error)
        }
    }

    async _creatingRooms(row) {
        try {
            const rooms = [];
            const meetingRoom = await Room.findOneAndUpdate(
                { name: 'Meeting Room' },
                { name: 'Meeting Room' },
                this.updateOptions);
            if (row[26].trim().toLowerCase() === 'yes') {
                const eventRoom = await Room.findOneAndUpdate(
                    { name: 'Event Room' },
                    { name: 'Event Room' },
                    this.updateOptions);
                const eventRoomRow = {
                    room: eventRoom._id,
                    data: [{ name: 'Event Room 1', capacity: 0, price: 0 }]
                }
                rooms.push(eventRoomRow);
            }
            const room = {
                room: meetingRoom._id,
                data: []
            }
            if (Number(row[17].trim().split('/')[0]) !== +0) {
                room.data.push({
                    name: 'Meeting Room 1', capacity: Number(row[16].trim()) || 0,
                    price: Number(row[17].trim().split('/')[0])
                })
            }
            if (Number(row[19].trim().split('/')[0]) !== +0) {
                room.data.push({
                    name: 'Meeting Room 2', capacity: Number(row[18].trim()) || 0,
                    price: Number(row[19].trim().split('/')[0])
                })
            }
            if (Number(row[21].trim().split('/')[0]) !== +0) {
                room.data.push({
                    name: 'Meeting Room 3', capacity: Number(row[20].trim()) || 0,
                    price: Number(row[21].trim().split('/')[0])
                })
            }
            if (Number(row[23].trim().split('/')[0]) !== +0) {
                room.data.push({
                    name: 'Meeting Room 4', capacity: Number(row[22].trim()) || 0,
                    price: Number(row[23].trim().split('/')[0])
                })
            }
            if (Number(row[25].trim().split('/')[0]) !== +0) {
                room.data.push({
                    name: 'Meeting Room 5', capacity: Number(row[24].trim()) || 0,
                    price: Number(row[25].trim().split('/')[0])
                })
            }
            rooms.push(room);
            return rooms;
        } catch (error) {
            throw (error)
        }
    }

    _creatingPlans(row) {
        try {
            let plans = [];
            if (Number(row[6].split('/')[0].replace(/,/g, '').replace(/"/g, '').trim()) !== 0) {
                plans.push({
                    category: 'hot-desk',
                    price: Number(row[6].split('/')[0].replace(/,/g, '').replace(/"/g, '').trim()),
                    duration: 'month'
                })
            }
            if (row[7] && Number(row[7].split('/')[0].replace(/,/g, '').replace(/"/g, '').trim()) !== 0) {
                plans.push({
                    category: 'dedicated-desk',
                    price: Number(row[7].split('/')[0].replace(/,/g, '').replace(/"/g, '').trim()),
                    duration: 'month'
                })
            }
            if (row[8] && Number(row[8].split('/')[0].replace(/,/g, '').replace(/"/g, '').trim()) !== 0) {
                plans.push({
                    category: 'private-cabin',
                    price: Number(row[8].split('/')[0].replace(/,/g, '').replace(/"/g, '').trim()),
                    duration: 'month'
                })
            }
            if (row[10] && Number(row[10].split('/')[0].replace(/,/g, '').replace(/"/g, '').trim()) !== 0) {
                plans.push({
                    category: 'day-pass',
                    price: Number(row[10].split('/')[0].replace(/,/g, '').replace(/"/g, '').trim()),
                    duration: 'day'
                })
            }
            return plans;
        } catch (error) {
            throw (error)
        }
    }

    _createFacilitiesForOffice(item) {
        try {
            const facilities = item.split(',');
            return facilities.map(obj => {
                const split = obj.split('-');
                const name = split[0].split('"')[1] || split[0].split('"')[0]
                return {
                    name: name.trim().toLocaleLowerCase(),
                    value: Number(split[0].trim()) || 1
                }
            })
        } catch (error) {
            throw (error);
        }
    }
}

export default new ManageExcelUpload()