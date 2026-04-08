import models from '../../models/index.js';
const CoworkingInventory = models['CoworkingInventory'];
import csvParser from 'csv-parser';
import path from 'path';
import aws from '../../utilities/aws.js';
import stream from 'stream';

class ManageCoworkingInventoryPageService {

    constructor() {
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };

        return {
            getCoworkingInventoryById: this.getCoworkingInventoryById.bind(this),
            createCoworkingInventory: this.createCoworkingInventory.bind(this),
            updateCoworkingInventory: this.updateCoworkingInventory.bind(this),
            getCoworkingInventories: this.getCoworkingInventories.bind(this),
            deleteWorkSpaceInventory: this.deleteWorkSpaceInventory.bind(this),
            uploadInventory: this.uploadInventory.bind(this),
            leadRegisterOnMail: this.leadRegisterOnMail.bind(this)
        }

    }
    cleanFlatObject(obj) {
        const cleaned = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const value = obj[key];
                cleaned[key] = typeof value === 'string' ? value.trim() : value;
            }
        }
        return cleaned;
    }

    restructureData(flatObject) {
        flatObject = this.cleanFlatObject(flatObject);
        let structuredData = { ...flatObject };
    
        // Build contact_details array
        const contactDetailsMap = {};
        Object.keys(flatObject).forEach((key) => {
            const match = key.match(/^contact_details\[(\d+)]\.(.+)$/);
            if (match) {
                const index = parseInt(match[1], 10);
                const field = match[2];
                contactDetailsMap[index] = contactDetailsMap[index] || {};
                contactDetailsMap[index][field] = flatObject[key];
            }
        });
    
        // Only include contact details if phone_number exists
        structuredData.contact_details = Object.values(contactDetailsMap).filter(detail => detail.phone_number);
    
        // Build plans array
        const plansMap = {};
        Object.keys(flatObject).forEach((key) => {
            const match = key.match(/^plans\[(\d+)]\.(.+)$/);
            if (match) {
                const index = parseInt(match[1], 10);
                const field = match[2];
                plansMap[index] = plansMap[index] || {};
                plansMap[index][field] = flatObject[key];
            }
        });
    
        // Only include plans with a price field
        structuredData.plans = Object.values(plansMap).filter(plan => plan.price);
    
        if (structuredData.location) {
            structuredData.location = {
                address: flatObject['location.address'] || '',
                country: flatObject['location.country'] || null,
                state: flatObject['location.state'] || null,
                city: flatObject['location.city'] || null,
                micro_location: flatObject['location.micro_location'] || null,
                landmark: flatObject['location.landmark'] || '',
                landmark_distance: flatObject['location.landmark_distance'] || '',
                latitude: parseFloat(flatObject['location.latitude']) || 0,
                longitude: parseFloat(flatObject['location.longitude']) || 0,
                is_near_metro: flatObject['location.is_near_metro'] === 'true',
            };
        }
    
        structuredData.is_active = flatObject['is_active'] === 'true';
        structuredData.no_of_seats = parseInt(flatObject['no_of_seats'], 10) || 0;
        structuredData.space_type = flatObject['space_type'] || '';
    
        return structuredData;
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

            const processedData = data.map(item => ({
                ...this.restructureData(item),
                added_on: new Date()
            }));

            const CHUNK_SIZE = 500;
            for (let i = 0; i < processedData.length; i += CHUNK_SIZE) {
                await CoworkingInventory.insertMany(processedData.slice(i, i + CHUNK_SIZE));
            }

            return { success: true, message: `Inserted ${processedData.length} records` };

        } catch (error) {
            throw error;
        }
    }

    async getCoworkingInventories({
        limit = 10,
        sortBy = 'name',
        orderBy = 1,
        skip = 0,
        name,
        productId,
        city,
        location,
        micro_location,
        isActive,
        userid,
        status,
        cities,
        space_type,
        minPrice,
        maxPrice
    }) {
        try {
            let conditions = [];
            let result = {};
            // STEP 1: Apply `cities` filter
            if (cities) {
                const cityArray = Array.isArray(cities) ? cities : [cities];
                conditions.push({
                    'location.city': {
                        $in: cityArray.map(c => new RegExp(`^${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'))
                    }
                });
            }            
    
            // STEP 2: Apply `city`
            if (city) {
                const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                conditions.push({
                    'location.city': {
                        $regex: new RegExp(escapedCity, 'i')
                    }
                });
            }
    
            // STEP 3: Other filters
            let additionalFilters = {};
    
            if (name) {
                name = name.replace(/[^A-Za-z0-9 ]/g, "");
                additionalFilters['name'] = { $regex: new RegExp(name, 'i') };
            }
    
            if (space_type) {
                additionalFilters['space_type'] = { $regex: `^${space_type}$`, $options: "i" };
            }
    
            if (productId) {
                productId = productId.replace(/[^A-Za-z0-9 ]/g, "");
                additionalFilters['productId'] = { $regex: new RegExp(productId, 'i') };
            }
    
            if (location) {
                additionalFilters['location.micro_location'] = {
                    $regex: new RegExp(location, 'i')
                };
            }
    
            if (micro_location) {
                additionalFilters['location.micro_location'] = micro_location;
            }
    
            if (isActive) {
                additionalFilters['status'] = 'approve';
            }
    
            if (userid) {
                additionalFilters['user'] = userid;
            }
    
            if (status && status !== 'all') {
                additionalFilters['status'] = status;
            }
    
            if (Object.keys(additionalFilters).length > 0) {
                conditions.push(additionalFilters);
            }
    
            const finalCondition = conditions.length > 0 ? { $and: conditions } : {};
    
            // START AGGREGATION
            const aggregatePipeline = [];
    
            if (Object.keys(finalCondition).length > 0) {
                aggregatePipeline.push({ $match: finalCondition });
            }
    
            if (minPrice && maxPrice) {
                aggregatePipeline.push(
                    {
                        $addFields: {
                            plans: {
                                $filter: {
                                    input: '$plans',
                                    as: 'plan',
                                    cond: {
                                        $and: [
                                            { $gte: ['$$plan.price', +minPrice] },
                                            { $lte: ['$$plan.price', +maxPrice] },
                                            // { $eq: ['$$plan.duration', 'month'] }
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    {
                        $match: {
                            plans: { $ne: [] }
                        }
                    }
                );
            }
            const countAggregation = [...aggregatePipeline];
            // Sorting, skipping, limiting
            aggregatePipeline.push(
                { $sort: { [sortBy]: orderBy } },
                { $skip: skip },
                { $limit: limit }
            );
    
            result.coworkingInventoryDetails = await CoworkingInventory.aggregate(aggregatePipeline);
            countAggregation.push(
                { $count: "total" }
            );
            const countResult = await CoworkingInventory.aggregate(countAggregation);
            result.count = countResult[0]?.total || 0;
            return result;
        } catch (error) {
            throw error;
        }
    }
    

    async getCoworkingInventoryById({ inventoryId }) {
        try {
            const CoworkingInventoryDetails = await CoworkingInventory.findOne({ _id: inventoryId });
            return CoworkingInventoryDetails;
        } catch (error) {
            throw error;
        }
    }

    async createCoworkingInventory({
        name,
        description,
        space_type,
        contact_details,
        location,
        no_of_seats,
        plans,
        is_active,
        status,
        brand,
        hours_of_operation
    }) {
        try {
            return await CoworkingInventory.create({
                name,
                description,
                contact_details,
                space_type,
                location,
                no_of_seats,
                plans,
                is_active,
                status,
                brand,
                hours_of_operation,
            })
        } catch (error) {
            throw error;
        }
    }

    async updateCoworkingInventory({
        id,
        name,
        description,
        contact_details,
        space_type,
        location,
        no_of_seats,
        hours_of_operation,
        plans,
        is_active,
        status,
        brand,
    }) {
        try {
            return await CoworkingInventory.findOneAndUpdate({ _id: id }, {
                name,
                description,
                contact_details,
                location,
                space_type,
                hours_of_operation,
                no_of_seats,
                plans,
                is_active,
                status,
                brand,
            })
        } catch (error) {
            throw error;
        }
    }
    async deleteWorkSpaceInventory({ id }) {
        try {
            await CoworkingInventory.deleteOne({ _id: id });
            return true;
        } catch (error) {
            throw (error);
        }
    }
    async leadRegisterOnMail({ toEmails, htmlVariables, bccAddresses, ccAddresses }) {
        // Validate input
        if (!toEmails || toEmails.length === 0) {
            throw new Error('No email received');
        }
        // Validate email format (you might want a better validation)
        if (toEmails.some(email => !email.includes('@'))) {
            throw new Error('Invalid email format');
        }
        try {
            const getTemplateObject = this._createTemplateObjects(toEmails, htmlVariables);
            await aws.sendMail(getTemplateObject.userParams);

            return {
                success: true,
                message: "Email sent successfully!",
                data: { /* any relevant data */ }
            };
        } catch (awsError) {
            throw new Error('Failed to send email due to server error');
        }
    }
    _createTemplateObjects(email, htmlVariables) {
        return {
            userParams: {
                toEmails: [...email],
                templateName: 'leadRegister',
                htmlVariables: {
                    text: htmlVariables
                },
                bccAddresses: [],
                ccAddresses: []
            }
        }
    }
    pad(n) {
        var s = "000" + n;
        return s.substr(s.length - 4);
    }
}

export default new ManageCoworkingInventoryPageService();