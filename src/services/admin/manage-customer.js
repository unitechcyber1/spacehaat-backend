import models from '../../models/index.js';
const Customer = models['Customer'];
import csvParser from 'csv-parser';
import path from 'path';
import stream from 'stream';

class ManageCustomerPageService {

    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };

        return {
            getCustomerById: this.getCustomerById.bind(this),
            createCustomer: this.createCustomer.bind(this),
            updateCustomer: this.updateCustomer.bind(this),
            getCustomers: this.getCustomers.bind(this),
            deleteCustomer: this.deleteCustomer.bind(this),
            uploadInventory: this.uploadInventory.bind(this),
        }

    }
    parseDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return null;
    
        dateStr = dateStr.trim();
        const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (!match) return null;
    
        let [ , day, month, year ] = match.map(Number);
    
        // Convert 2-digit years to 4-digit
        if (year < 100) {
            year += 2000;
        }
    
        // Use UTC to prevent timezone shift
        return new Date(Date.UTC(year, month - 1, day));
    }
    
    
    trimFields(obj) {
        for (let key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = obj[key].trim();
            }
        }
        return obj;
    }
    async uploadInventory(file) {
        try {
            if (!file) throw new Error('NO_FILE');
            const fileExtension = path.extname(file.name).toLowerCase();
            const validExtensions = ['.xlsx', '.csv'];
            if (!validExtensions.includes(fileExtension)) throw new Error('INVALID_FILE_TYPE');

            let data = [];

            if (fileExtension === '.xlsx') {
                const workbook = await xlsxPopulate.fromDataAsync(file.data);
                const sheet = workbook.sheet(0);
                data = sheet.usedRange().value();
            } else {
                await new Promise((resolve, reject) => {
                    const readStream = stream.Readable.from(file.data.toString('utf8'));
                    readStream.pipe(csvParser())
                        .on('data', (row) => data.push(row))
                        .on('error', reject)
                        .on('end', resolve);
                });
            }
            if (data.length === 0) throw new Error('EMPTY_FILE');

            const processedData = data.map(item => {
                const trimmedItem = this.trimFields(item);
                return {
                    ...trimmedItem,
                    added_on: new Date(),
                    date_of_closure: this.parseDate(trimmedItem.date_of_closure),
                    start_date: this.parseDate(trimmedItem.start_date),
                    lease_expire_date: this.parseDate(trimmedItem.lease_expire_date)
                };
            });
            const CHUNK_SIZE = 500;
            for (let i = 0; i < processedData.length; i += CHUNK_SIZE) {
                await Customer.insertMany(processedData.slice(i, i + CHUNK_SIZE));
            }

            return { success: true, message: `Inserted ${processedData.length} records` };

        } catch (error) {
            throw error;
        }
    }

    async getCustomers({ limit = 10, sortBy = 'name', orderBy = 1, skip, name, city, location }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                /** TODO $text search will be implemented */
                name = name.replace(/[^A-Za-z0-9 ]/g, "");
                condition['client.name'] = { '$regex': `^(\s+${name}|^${name})`, '$options': 'i' };
            }
            if (city) {
                city = '.*' + city + '.*';
                condition['location.city'] = { $regex: new RegExp('^' + city + '$', 'i') };;
            }
            if (location) {
                location = '.*' + location + '.*';
                condition['location.microlocation'] = { $regex: new RegExp('^' + location + '$', 'i') };
            }
            result.CustomerDetails = await Customer.find(condition)
                .limit(limit)
                .skip(skip)
                .sort({
                    added_on: -1
                });
            result.count = await Customer.countDocuments(condition);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getCustomerById({ customerId }) {
        try {
            const CustomerDetails = await Customer.findOne({ _id: customerId });
            return CustomerDetails;
        } catch (error) {
            throw error;
        }
    }

    async createCustomer({
        client,
        operator,
        space_type,
        location,
        date_of_closure,
        no_of_seats,
        seat_price,
        agreement_duration,
        lockin_period,
        cofynd_revenue,
        payment_status,
        start_date,
        lease_expire_date,
        lead_owner,
    }) {
        try {
            return await Customer.create({
                client,
                operator,
                space_type,
                location,
                date_of_closure,
                no_of_seats,
                seat_price,
                agreement_duration,
                lockin_period,
                cofynd_revenue,
                payment_status,
                start_date,
                lease_expire_date,
                lead_owner,
            })
        } catch (error) {
            throw error;
        }
    }

    async updateCustomer({
        id,
        client,
        operator,
        space_type,
        location,
        date_of_closure,
        no_of_seats,
        seat_price,
        agreement_duration,
        lockin_period,
        cofynd_revenue,
        payment_status,
        start_date,
        lease_expire_date,
        lead_owner,
    }) {
        try {
            return await Customer.findOneAndUpdate({ _id: id }, {
                client,
                operator,
                space_type,
                location,
                date_of_closure,
                no_of_seats,
                seat_price,
                agreement_duration,
                lockin_period,
                cofynd_revenue,
                payment_status,
                start_date,
                lease_expire_date,
                lead_owner,
            })
        } catch (error) {
            throw error;
        }
    }
    async deleteCustomer({ id }) {
        try {
            await Customer.deleteOne({ _id: id });
            return true;
        } catch (error) {
            throw (error);
        }
    }
}

export default new ManageCustomerPageService();