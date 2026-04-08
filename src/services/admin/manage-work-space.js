import models from '../../models/index.js';
import crypto from 'crypto';
import FileUtility from '../../utilities/file.js';
import { findCountryByCoordinate } from "country-locator";
import { getCountry } from 'country-currency-map';
import aws from '../../utilities/aws.js';
import app from '../../config/app.js'
import axios from 'axios';
import FileUpload from '../../controllers/common/fileUpload.js'
// import { sheets } from '../../utilities/uploadToExcelSheet.js';
// const { web_query_sheet } = require('../../utilities/queryToExcelSheet');
const spreadsheetId = "1uwiOeDkq4Bq596adnXC5bfE7SWFyscrLNcQOv7vVdqc";
import { web_query_sheet } from '../../utilities/queryToExcelSheet.js';
import mongoose from 'mongoose';
const { ObjectId } = mongoose.Types;
const range = "Coworking!A2:C2"; // Update row 2 in Sheet1
const WorkSpace = models['WorkSpace'];
const Image = models['Image'];
const User = models['User'];
const CoLivingSpace = models['CoLivingSpace'];
const Flats = models['Flats'];
const OfficeSpace = models['OfficeSpace'];
const MicroLocation = models['MicroLocation'];
const Country = models['Country'];

class ManageWorkSpaceService {
    constructor() {
        this.axiosConfig = {
            headers: {
                'Content-Type': 'application/json'
            }
        }
        this.updateOptions = {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        };
        return {
            getWorkSpaces: this.getWorkSpaces.bind(this),
            allSpacesAddedBySellerAccount: this.allSpacesAddedBySellerAccount.bind(this),
            getWorkSpaceById: this.getWorkSpaceById.bind(this),
            getuserWorkSpaceById: this.getuserWorkSpaceById.bind(this),
            createWorkSpace: this.createWorkSpace.bind(this),
            updateWorkSpace: this.updateWorkSpace.bind(this),
            changeWorkSpaceStatus: this.changeWorkSpaceStatus.bind(this),
            addPopularWorkSpaces: this.addPopularWorkSpaces.bind(this),
            addPriorityWorkSpaces: this.addPriorityWorkSpaces.bind(this),
            sortPopularWorkSpaces: this.sortPopularWorkSpaces.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
            deleteWorkSpace: this.deleteWorkSpace.bind(this),
            updatePlanProperty: this.updatePlanProperty.bind(this),
            changeSlugById: this.changeSlugById.bind(this),
            _createDynamicPriorityType: this._createDynamicPriorityType.bind(this),
            totalProperties: this.totalProperties.bind(this),
            spaceOrderByDrag: this.spaceOrderByDrag.bind(this),
            updateCalendar: this.updateCalendar.bind(this),
            listingAccess: this.listingAccess.bind(this)
        }
    }

    async listingAccess({ payload }) {
        const { workspace = [], coliving = [], officespace = [], flats = [], userIds = [], action = 'add' } = payload;
        const updates = [];
        const updateAssignedUsers = (Model, ids) => {
            return Promise.all(
                ids.map(id => {
                    const updateQuery =
                        action === 'add'
                            ? { $addToSet: { assignedUsers: { $each: userIds } } }
                            : { $pull: { assignedUsers: { $in: userIds } } };

                    return Model.findByIdAndUpdate(id, updateQuery, { new: true });
                })
            );
        };
        try {
            if (workspace.length) {
                updates.push(updateAssignedUsers(WorkSpace, workspace));
            }

            if (coliving.length) {
                updates.push(updateAssignedUsers(CoLivingSpace, coliving));
            }
            if (flats.length) {
                updates.push(updateAssignedUsers(Flats, flats));
            }

            if (officespace.length) {
                updates.push(updateAssignedUsers(OfficeSpace, officespace));
            }

            const results = await Promise.all(updates);
            return results.flat();
        } catch (err) {
            throw (err)
        }
    }

    async getWorkSpaces({ limit = 10, sortBy = 'name', orderBy = 1, skip, name, productId, city, location, micro_location, isActive, userid, status, virtual }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                /** TODO $text search will be implemented */
                name = name.replace(/[^A-Za-z0-9 ]/g, "");
                condition['name'] = { '$regex': `^(\s+${name}|^${name})`, '$options': 'i' };
            }
            if (productId) {
                productId = productId.replace(/[^A-Za-z0-9 ]/g, "");
                condition['productId'] = { '$regex': `^(\s+${productId}|^${productId})`, '$options': 'i' };
            }
            if (city) {
                condition['location.city'] = city;
            }
            if (location) {
                let microid = [];
                let mcondition = {};
                location = '.*' + location + '.*';
                mcondition['name'] = { $regex: new RegExp('^' + location + '$', 'i') };
                let microlocation = await MicroLocation.find(mcondition, { _id: 1 });
                for (const key in microlocation) {
                    microid.push(microlocation[key]['id']);
                }
                condition['location.micro_location'] = { "$in": microid };
            }
            if (micro_location) {
                condition['location.micro_location'] = micro_location;
            }
            if (isActive) {
                condition['status'] = 'approve';
            }
            if (userid) {
                condition['user'] = userid;
            }
            if (status) {
                condition['status'] = status;
            }
            if (status == 'all') {
                delete condition['status']
            }
            if (virtual) {
                const virtualId = [
                    '681075096db4f288ebc096fc',
                    '681074d76db4f288ebc06e58',
                    '681074ed6db4f288ebc080e5'
                ];
                condition['plans'] = {
                    $elemMatch: { category: { $in: virtualId } }
                };
            }
            result.workSpaces = await WorkSpace.find(condition)
                .populate('location.micro_location')
                .populate('location.city')
                .populate('location.country')
                .populate('images.image')
                .populate('images.image')
                .populate('user')
                .limit(limit)
                .skip(skip)
                .sort({
                    createdAt: -1
                });
            result.count = await WorkSpace.countDocuments(condition);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async updateCalendar({ calendar, id }) {
        try {
            return await WorkSpace.findOneAndUpdate({ _id: id }, { calendar })
        } catch (error) {
            throw error;
        }
    }

    async allSpacesAddedBySellerAccount({ limit, page, sortBy = 'name', orderBy = 1, skip, name, productId, city, location, micro_location, isActive, userid, role, space_type_key, status }) {
        try {
            let result = {};
            let condition = {};
            const pageNumber = parseInt(page) || 1;
            const limitNumber = parseInt(limit) || 10;
            const skip = (pageNumber - 1) * limitNumber;
            condition['added_by_user'] = 'seller';
            if (role == 'sales' && userid) {
                const cleanUserId = new ObjectId(userid.toString().replace(/['"]+/g, ''));
                condition['$or'] = [
                    { assignedUsers: { $in: [cleanUserId] } },
                    { assignedUsers: { $exists: false } },
                    { assignedUsers: { $size: 0 } },
                    { user: cleanUserId }
                ];

                if (condition.user) delete condition.user;

            }
            else if (userid) {
                condition['user'] = new ObjectId(userid.toString().replace(/['"]+/g, ''));
            }
            if (name) {
                /** TODO $text search will be implemented */
                name = name.replace(/[^A-Za-z0-9 ]/g, "");
                condition['name'] = { '$regex': `^(\s+${name}|^${name})`, '$options': 'i' };
            }
            if (productId) {
                productId = productId.replace(/[^A-Za-z0-9 ]/g, "");
                condition['productId'] = { '$regex': `^(\s+${productId}|^${productId})`, '$options': 'i' };
            }
            if (city) {
                condition['location.city'] = city;
            }
            if (location) {
                location = '.*' + location + '.*';
                condition['location.name'] = { $regex: new RegExp('^' + location + '$', 'i') };
            }
            if (micro_location) {
                condition['location.micro_location'] = micro_location;
            }
            if (isActive) {
                condition['status'] = 'approve';
            }
            // if (userid) {
            //     condition['user'] = userid;
            // }
            if (space_type_key) {
                condition['space_type_key'] = space_type_key;
            }
            if (space_type_key == 'all') {
                delete condition['space_type_key']
            }
            if (status) {
                condition['status'] = status;
            }
            if (status == 'all') {
                delete condition['status']
            }
            let workSpaceList = await WorkSpace.find(condition)
                .populate('location.city')
                .populate('location.country')
                .populate('images.image')
                .populate('user')
                .populate('assignedUsers', 'name email')
                .skip(skip)
                .limit(limitNumber)
                .sort({
                    createdAt: -1
                });
            let officeSpaceList = await OfficeSpace.find(condition)
                .populate('location.city')
                .populate('images.image')
                .populate('user')
                .populate('assignedUsers', 'name email')
                .skip(skip)
                .limit(limitNumber)
                .sort({
                    createdAt: -1
                });
            let flatSpaceList = await Flats.find(condition)
                .populate('location.city')
                .populate('location.country')
                .populate('images.image')
                .populate('coliving_plans.planId')
                .populate('assignedUsers', 'name email')
                .populate('user')
                .skip(skip)
                .limit(limitNumber)
                .sort({
                    createdAt: -1
                });
            let colivingSpaceList = await CoLivingSpace.find(condition)
                .populate('location.city')
                .populate('location.country')
                .populate('images.image')
                .populate('assignedUsers', 'name email')
                .populate('user')
                .skip(skip)
                .limit(limitNumber)
                .sort({
                    createdAt: -1
                });
            let allSpacesList = [...workSpaceList, ...officeSpaceList, ...flatSpaceList, ...colivingSpaceList];
            allSpacesList = allSpacesList.sort(function (a, b) {
                return new Date(b.added_on).valueOf() - new Date(a.added_on).valueOf();
            });
            result.allSpacesList = allSpacesList;
            let WorkSpacecount = await WorkSpace.countDocuments(condition);
            let livingSpacecount = await CoLivingSpace.countDocuments(condition);
            let flatSpacecount = await Flats.countDocuments(condition);
            let officeSpacecount = await OfficeSpace.countDocuments(condition);
            let totalCount = +WorkSpacecount + +livingSpacecount + +flatSpacecount + +officeSpacecount;
            result.count = totalCount;
            return result;
        } catch (error) {
            throw error;
        }
    }



    async totalProperties({ limit = 10, sortBy = 'name', orderBy = 1, skip, name, city, location, micro_location, isActive, userid }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                /** TODO $text search will be implemented */
                name = name.replace(/[^A-Za-z0-9 ]/g, "");
                condition['name'] = { '$regex': `^(\s+${name}|^${name})`, '$options': 'i' };
            }
            if (city) {
                condition['location.city'] = city;
            }
            if (location) {
                location = '.*' + location + '.*';
                condition['location.name'] = { $regex: new RegExp('^' + location + '$', 'i') };
            }
            if (micro_location) {
                condition['location.micro_location'] = micro_location;
            }
            if (isActive) {
                condition['status'] = isActive;
            }
            if (userid) {
                condition['user'] = userid;
            }
            let workspaceCount = await WorkSpace.countDocuments(condition);
            let livingspaceCount = await CoLivingSpace.countDocuments(condition);
            let flatspaceCount = await Flats.countDocuments(condition);
            let officespaceCount = await OfficeSpace.countDocuments(condition);
            result.count = +workspaceCount + +livingspaceCount + +flatspaceCount + +officespaceCount;
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getWorkSpaceById({ workSpaceId }) {
        try {
            const workSpaces = await WorkSpace.findOne({ _id: workSpaceId })
                .populate('amenties')
                .populate({
                    path: 'rooms.room'
                })
                .populate('images.image')
                .populate('plans.image')
                .populate('seo.twitter.image')
                .populate('user')
                .populate('seo.open_graph.image');
            return workSpaces;
        } catch (error) {
            throw error;
        }
    }

    async getuserWorkSpaceById({ workSpaceId }) {
        try {
            const workSpaces = await WorkSpace.findOne({ _id: workSpaceId })
                .populate('amenties')
                .populate({
                    path: 'rooms.room'
                })
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('user')
                .populate('location.city')
                .populate('location.micro_location')
                .populate('plans.category')
                .populate('seo.open_graph.image');
            return workSpaces;
        } catch (error) {
            throw error;
        }
    }

    async createWorkSpace({
        name,
        description,
        email,
        ratings,
        spaceTag,
        slug,
        no_of_seats,
        space_contact_details,
        small_team_availability,
        enterprise_availability,
        contact_details,
        website_Url,
        images,
        amenties,
        social_media,
        location,
        hours_of_operation,
        facilities,
        rooms,
        plans,
        brand,
        seo,
        virtualSeo,
        user,
        added_by_user,
        desk_types,
        city_name,
        opening_hours,
        calendar,
    }) {
        try {
            var expiryDate = new Date();
            var geometry;
            let finalSlug;
            expiryDate.setMonth(expiryDate.getMonth() + 3);
            let expireAt = expiryDate;
            let space_type_key = 'coworking'
            const d = new Date();
            let year = d.getFullYear();
            let totalCount = await WorkSpace.countDocuments();
            let finalCount = totalCount + 1;
            let productId = `CFCW${year}${this.pad(finalCount)}`
            if (location && location.latitude && location.longitude) {
                const countryInfo = findCountryByCoordinate(+location.latitude, +location.longitude);
                let country_name = countryInfo.name;
                let currency_code = getCountry(country_name).currency;
                geometry = this._setGeoLocation(location);
            }
            if (user) {
                finalSlug = await this._createSlug(null, name, location.name);
            }
            else {
                finalSlug = slug;
            }
            console.log('location---->', location.country, Object())
            const country_details = await Country.findOne({ _id: location.country });
            let currency_code = getCountry(country_details.name).currency;
            let country_dbname = country_details.name;

            if (user) {
                //space details to official mailId...
                const userDetails = await User.findOne({ _id: user });
                let amentiesDetails;
                let amenties_names = [];
                for (const key in amenties) {
                    amenties_names.push(amenties[key]['name']);
                    amentiesDetails = amenties_names.join(', ')
                }
                let spaceAddress = location.address1;
                const getTemplateObject = this._createTemplateObjects({ userDetails, name, no_of_seats, desk_types, opening_hours, amentiesDetails, city_name, spaceAddress });
                await aws.sendMail(getTemplateObject.listingParams);
                //space details to leadsquared...
                let lead_id = null;
                const body = this.sanitozeRequestBody({
                    userDetails,
                    name,
                    no_of_seats,
                    desk_types,
                    city_name,
                    spaceAddress,
                });
                // lead_id = await this.leadSquadApiCall(body);

                //space details to excelsheet...
                let hotdesk_amount;
                let dedicated_desk_amount;
                let private_cabin_amount;
                let virtual_office_amount;
                let office_space_amount;
                let landmark = location.landmark;
                let near_metro = location.metro_stop_landmark;
                let img_count = images.length;
                const now = new Date();
                const year = now.getFullYear();
                const month = now.getMonth() + 1; // add 1 because getMonth() returns 0-indexed months
                const day = now.getDate();
                const formattedDate = `${day}-${month}-${year}`;
                for (let index = 0; index < plans.length; index++) {
                    if (plans[index].category == '6231b1b42a52af3ddaa73a46') {
                        hotdesk_amount = `${plans[index]['price']} per/${plans[index]['duration']}`
                    }
                    if (plans[index].category == '6231b1db2a52af3ddaa73a48') {
                        dedicated_desk_amount = `${plans[index]['price']} per/${plans[index]['duration']}`
                    }
                    if (plans[index].category == '6231b1ec2a52af3ddaa73a4a') {
                        private_cabin_amount = `${plans[index]['price']} per/${plans[index]['duration']}`
                    }
                    if (plans[index].category == '6231bca42a52af3ddaa73ab1') {
                        virtual_office_amount = `${plans[index]['price']} per/${plans[index]['duration']}`
                    }
                    if (plans[index].category == '62833d8193f2bd4e9f1a3ceb') {
                        office_space_amount = `${plans[index]['price']} per/${plans[index]['duration']}`
                    }
                }
                const values = [
                    [
                        formattedDate,
                        city_name,
                        'Pending',
                        userDetails.name,
                        userDetails.email,
                        userDetails.phone_number,
                        name,
                        no_of_seats,
                        description,
                        desk_types,
                        hotdesk_amount,
                        dedicated_desk_amount,
                        private_cabin_amount,
                        virtual_office_amount,
                        office_space_amount,
                        opening_hours,
                        amentiesDetails,
                        spaceAddress,
                        near_metro,
                        landmark,
                        img_count,
                    ],
                ];
                const resource = {
                    values,
                };
                await this.uploadToExcelsheet(resource)
            }

            return await WorkSpace.create({
                name,
                description,
                space_contact_details,
                currency_code,
                country_dbname,
                email,
                ratings,
                spaceTag,
                no_of_seats,
                small_team_availability,
                enterprise_availability,
                contact_details,
                website_Url,
                images,
                amenties,
                social_media,
                location,
                geometry,
                hours_of_operation,
                facilities,
                rooms,
                plans,
                slug: finalSlug,
                brand,
                seo,
                virtualSeo,
                user,
                expireAt,
                productId,
                added_by_user,
                space_type_key,
                calendar,
            })
        } catch (error) {
            throw error;
        }
    }

    //upload to excel sheet function...
    async uploadToExcelsheet(resource) {
        await web_query_sheet.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: "USER_ENTERED", // Use user-entered values
            resource,
        },
            (err, result) => {
                if (err) {
                    console.error(err);
                    return;
                }
                console.log(`cells updated.`);
            }
        );
    }

    sanitozeRequestBody({
        userDetails,
        name,
        no_of_seats,
        desk_types,
        city_name,
        spaceAddress,
    }) {
        try {
            const resposne = [{
                "Attribute": "EmailAddress",
                "Value": userDetails.email || '1test@qwert12.com'
            },
            {
                "Attribute": "FirstName",
                "Value": userDetails.name || 'No Name'
            },
            {
                "Attribute": "Phone",
                "Value": userDetails.phone_number || '9715876567'
            },
            {
                "Attribute": "mx_Name_of_space",
                "Value": name || ''
            },
            {
                "Attribute": "mx_Number_of_seats",
                "Value": +no_of_seats || 0
            },
            {
                "Attribute": "mx_Desk_type",
                "Value": desk_types || ''
            },
            {
                "Attribute": "mx_City",
                "Value": city_name || 'No City (Generic)'
            },
            {
                "Attribute": "mx_Street1",
                "Value": spaceAddress || ''
            },
            {
                "Attribute": "mx_Space_Type",
                "Value": 'List Coworking'
            },
                // {
                //     "Attribute": "RelatedCompanyId",
                //     "Value": 'ListingSpace'
                // },
            ];
            return resposne;
        } catch (error) {
            throw (error);
        }
    }

    async leadSquadApiCall(body) {
        try {
            let lead_id = null;
            const response = await axios.post(
                `${app.leadSquaredUrl}LeadManagement.svc/Lead.Capture?accessKey=${app.leadSquaredAccessToken}&secretKey=${app.leadSquaredSecretKey}`,
                body,
                this.axiosConfig
            );
            if (response.data && response.data.Status === 'Success') {
                lead_id = response.data.Message.Id;
            }
            return lead_id;
        } catch (error) {
            console.log(error);
        }
    }

    _createTemplateObjects({ userDetails, name, no_of_seats, desk_types, opening_hours, amentiesDetails, city_name, spaceAddress }) {
        let date = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        let visitorsDetail = userDetails.name.toUpperCase() + `<br />`;
        visitorsDetail += userDetails.phone_number + `<br />`;
        visitorsDetail += userDetails.email + `<br />`;
        return {
            listingParams: {
                toEmails: [app.listingEmail],
                templateName: 'listing',
                htmlVariables: {
                    centerName: name,
                    noOfSeats: no_of_seats,
                    deskTypes: desk_types,
                    openingHours: opening_hours,
                    amenties: amentiesDetails,
                    city: city_name,
                    address: spaceAddress,
                    date: date.toLocaleDateString("en-US", options),
                    time: date.toLocaleTimeString('en-US'),
                    visitorsDetail,
                },
                subjectVariables: { userName: userDetails.name, city: city_name, spaceType: 'Co-working' },
                bccAddresses: [],
                ccAddresses: []
            }
        }
    }

    _createCenterUrl(workSpace, officeSpace, livingSpace) {
        let object = { url: '', city: '', microlocation: '' };
        if (workSpace) {
            object.url = `http://cofynd.com/coworking/${workSpace.slug}`;
            if (workSpace.location.city) {
                object.city = workSpace.location.city.name;
            }
            if (workSpace.location.micro_location) {
                object.microlocation = workSpace.location.micro_location.name;
            }
        } else if (officeSpace) {
            object.url = `https://cofynd.com/office-space/rent/${officeSpace.slug}`;
            if (officeSpace.location.city) {
                object.city = officeSpace.location.city.name;
            }
            if (officeSpace.location.micro_location) {
                object.microlocation = officeSpace.location.micro_location.name;
            }
        } else if (livingSpace) {
            object.url = `https://cofynd.com/co-living/${livingSpace.slug}`;
            if (livingSpace.location.city) {
                object.city = livingSpace.location.city.name;
            }
            if (livingSpace.location.micro_location) {
                object.microlocation = livingSpace.location.micro_location.name;
            }
        }
        return object;
    }

    async updateWorkSpace({
        id,
        name,
        description,
        space_contact_details,
        email,
        ratings,
        spaceTag,
        brand,
        no_of_seats,
        small_team_availability,
        enterprise_availability,
        contact_details,
        website_Url,
        images,
        amenties,
        social_media,
        location,
        hours_of_operation,
        facilities,
        rooms,
        plans,
        seo,
        virtualSeo,
        added_by_user,
        calendar,
        planStatus
    }) {
        try {
            const geometry = this._setGeoLocation(location);
            const slug = await this._createSlug(id, name, location.name);
            const countryInfo = findCountryByCoordinate(+location.latitude, +location.longitude);
            let country_name = countryInfo.name;
            let currency_code = getCountry(country_name).currency;
            const country_details = await Country.findOne({ _id: location.country });
            let country_dbname = country_details.name;
            return await WorkSpace.findOneAndUpdate({ _id: id }, {
                name,
                description,
                space_contact_details,
                currency_code,
                country_dbname,
                email,
                ratings,
                spaceTag,
                brand,
                no_of_seats,
                small_team_availability,
                enterprise_availability,
                contact_details,
                website_Url,
                images,
                amenties,
                social_media,
                location,
                geometry,
                hours_of_operation,
                facilities,
                rooms,
                plans,
                slug,
                planStatus,
                seo,
                virtualSeo,
                added_by_user,
                calendar,
            })
        } catch (error) {
            throw error;
        }
    }

    async changeWorkSpaceStatus({ workSpaceId, status, planStatus }) {
        try {
            let updateData = {};
            if (status === 'reject') {
                updateData = {
                    "status": status,
                    "priority.overall.is_active": false,
                    "priority.overall.order": 1000,
                    "priority.location.is_active": false,
                    "priority.location.order": 1000,
                    "priority.micro_location.is_active": false,
                    "priority.micro_location.order": 1000,
                    "virtual_priority.location.is_active": false,
                    "virtual_priority.location.order": 1000,
                }
            } else {
                updateData = {
                    "status": status,
                }
            }
            if (planStatus) {
                updateData["planStatus"] = planStatus
            }

            return await WorkSpace.findOneAndUpdate({ _id: workSpaceId }, { $set: updateData });
        } catch (error) {
            throw error;
        }
    }

    async addPopularWorkSpaces({ data }) {
        try {
            await WorkSpace.update({ '_id': data.id }, { $set: { is_popular: data.is_popular } });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    async addPriorityWorkSpaces({ id, type, data, virtual_priority }) {
        try {
            if (virtual_priority) {
                let object = this._createDynamicPriorityType(type, virtual_priority);
                if (!data.is_active) {
                    const { priority } = await WorkSpace.findOne({ _id: id }, { virtual_priority: 1 });
                    const priorityOrder = object + '.order';
                    const priorityActive = object + '.is_active';
                    const condition = {
                        [priorityOrder]: { $gt: priority[type].order },
                        [priorityActive]: true
                    };
                    if (data.city) {
                        condition['location.city'] = data.city;
                    }
                    await WorkSpace.updateMany(condition, {
                        $inc: {
                            [priorityOrder]: -1
                        }
                    });
                }
                await WorkSpace.updateOne({ '_id': id }, {
                    $set: {
                        ['virtual_priority.location']: data
                    }
                });
                return true;
            } else {
                let object = this._createDynamicPriorityType(type);
                if (!data.is_active) {
                    const { priority } = await WorkSpace.findOne({ _id: id }, { priority: 1 });
                    const priorityOrder = object + '.order';
                    const priorityActive = object + '.is_active';
                    const condition = {
                        [priorityOrder]: { $gt: priority[type].order },
                        [priorityActive]: true
                    };
                    if (data.city) {
                        condition['location.city'] = data.city;
                    }
                    await WorkSpace.updateMany(condition, {
                        $inc: {
                            [priorityOrder]: -1
                        }
                    });
                }
                await WorkSpace.updateOne({ '_id': id }, {
                    $set: {
                        [object]: data
                    }
                });
                return true;
            }
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

    async _createSlug(id, name, location) {
        try {
            if (id) {
                const ws = await WorkSpace.findOne({ _id: id });
                if (ws && ws.slug) {
                    return ws.slug;
                }
            }
            let slugName = `${name} ${location}`;
            slugName = slugName.toString().toLowerCase()
                .replace(/\s+/g, '-') // Replace spaces with -
                .replace(/[^\w\-]+/g, '') // Remove all non-word chars
                .replace(/\-\-+/g, '-') // Replace multiple - with single -
                .replace(/^-+/, '') // Trim - from start of text
                .replace(/-+$/, ''); // Trim - from end of text
            const ws = await WorkSpace.findOne({ slug: slugName });
            if (ws) {
                slugName = ws.slug + '-' + crypto.randomBytes(2).toString('hex');
            }
            return slugName;
        } catch (error) {
            throw (error);
        }
    }

    async sortPopularWorkSpaces({ initialPosition, finalPosition, shiftedId }) {
        try {
            if (initialPosition < finalPosition) {
                await WorkSpace.updateMany({
                    'is_popular.order': { $lte: finalPosition, $gt: initialPosition },
                    'is_popular.value': true
                }, { $inc: { 'is_popular.order': -1 } })
                await WorkSpace.updateOne({ _id: shiftedId }, { $set: { 'is_popular.order': finalPosition } })
            }
            if (initialPosition > finalPosition) {
                await WorkSpace.updateMany({
                    'is_popular.order': { $lt: initialPosition, $gte: finalPosition },
                    'is_popular.value': true
                }, {
                    $inc: { 'is_popular.order': 1 }
                })
                await WorkSpace.updateOne({
                    _id: shiftedId
                }, {
                    $set: { 'is_popular.order': finalPosition }
                })
            }
        } catch (e) {
            throw (e)
        }
    }

    async setPriorityByType({ initialPosition, finalPosition, shiftedId, type }) {
        try {
            const priorityOrder = this._createDynamicPriorityType(type) + '.order';
            const priorityActive = this._createDynamicPriorityType(type) + '.is_active';
            if (initialPosition < finalPosition) {
                await WorkSpace.updateMany({
                    [priorityOrder]: { $lte: finalPosition, $gt: initialPosition },
                    [priorityActive]: true
                }, {
                    $inc: {
                        [priorityOrder]: -1
                    }
                })
                await WorkSpace.updateOne({ _id: shiftedId }, {
                    $set: {
                        [priorityOrder]: finalPosition
                    }
                })
            }
            if (initialPosition > finalPosition) {
                await WorkSpace.updateMany({
                    [priorityOrder]: { $lt: initialPosition, $gte: finalPosition },
                    [priorityActive]: true
                }, {
                    $inc: {
                        [priorityOrder]: 1
                    }
                })
                await WorkSpace.updateOne({ _id: shiftedId }, {
                    $set: {
                        [priorityOrder]: finalPosition
                    }
                })
            }
        } catch (e) {
            throw (e)
        }
    }
    async spaceOrderByDrag({ updatedProjects, priorityType, virtual_priority }) {
        try {
            for (const project of updatedProjects) {
                const { _id, priority } = project;
                const objectPath = this._createDynamicPriorityType(priorityType, virtual_priority);
                const sourcePriority = virtual_priority ? project.virtual_priority : priority;
                const orderValue = sourcePriority?.[priorityType]?.order;
                if (orderValue === undefined) continue;
                const update = {
                    $set: {
                        [`${objectPath}.order`]: orderValue,
                        [`${objectPath}.is_active`]: orderValue !== 1000
                    }
                };

                await WorkSpace.findByIdAndUpdate(_id, update);
            }
        } catch (error) {
            console.error("Error updating priority:", error);
        }
    }

    async deleteWorkSpace({ id }) {
        try {
            const ws = await WorkSpace.findOne({ _id: id }).populate('images.image');
            ws.images.forEach(async (imageObject) => {
                const folder_name = FileUpload.findFolderFromPath(imageObject.image.s3_link);
                await Image.deleteOne({ _id: imageObject.image._id });
                await FileUtility.deleteFile(imageObject.image.name, folder_name);
            });
            await WorkSpace.deleteOne({ _id: id });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    async updatePlanProperty() {
        try {
            let workspaces = await WorkSpace.find({}, { plans: 1 });
            workspaces = workspaces.map(workspace => {
                workspace.plans = workspace.plans.map(plan => {
                    plan.should_show = true;
                    return plan;
                })
                return workspace;
            });
            workspaces.forEach(async (workspace) => {
                await WorkSpace.updateOne({ _id: workspace._id }, { "$set": { "plans": workspace.plans } });
            })
        } catch (error) {
            throw (error);
        }
    }

    async changeSlugById({ id, slug }) {
        try {
            const os = await WorkSpace.findOne({ slug, _id: { $nin: [id] } });
            if (os) {
                this._throwException('Opps! Slug is already used by another workspace');
            }
            await WorkSpace.findOneAndUpdate({ _id: id }, { slug });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    _createDynamicPriorityType(type, virtual_priority = false) {
        let base = virtual_priority ? 'virtual_priority' : 'priority';

        switch (type) {
            case 'location':
                return `${base}.location`;
            case 'micro_location':
                return `${base}.micro_location`;
            default:
                return `${base}.overall`;
        }
    }


    _throwException(message) {
        throw ({
            name: "cofynd",
            code: 400,
            message
        })
    }
    pad(n) {
        var s = "000" + n;
        return s.substr(s.length - 4);
    }
}

export default new ManageWorkSpaceService();