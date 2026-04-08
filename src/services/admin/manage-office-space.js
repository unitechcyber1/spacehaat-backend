import models from '../../models/index.js';
import crypto from 'crypto';
import FileUtility from '../../utilities/file.js';
import aws from '../../utilities/aws.js';
import app from '../../config/app.js';
import axios from 'axios';
import manageWorkSpaceService from '../admin/manage-work-space.js';
import { web_query_sheet } from "../../utilities/queryToExcelSheet.js";
import FileUpload from '../../controllers/common/fileUpload.js'
// import { sheets } from '../../utilities/uploadToExcelSheet.js';
const spreadsheetId = "1uwiOeDkq4Bq596adnXC5bfE7SWFyscrLNcQOv7vVdqc";
const range = "Office Space!A2:C2"; // Update row 2 in Sheet1
const OfficeSpace = models['OfficeSpace'];
const User = models['User'];
const Image = models['Image'];

class ManageOfficeSpaceService {
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
            getOfficeSpaces: this.getOfficeSpaces.bind(this),
            getOfficeSpaceById: this.getOfficeSpaceById.bind(this),
            userofficeSpaces: this.userofficeSpaces.bind(this),
            createOfficeSpace: this.createOfficeSpace.bind(this),
            updateOfficeSpace: this.updateOfficeSpace.bind(this),
            addPopularOfficeSpaces: this.addPopularOfficeSpaces.bind(this),
            sortPopularOfficeSpaces: this.sortPopularOfficeSpaces.bind(this),
            changeOfficeSpaceStatus: this.changeOfficeSpaceStatus.bind(this),
            deleteOfficeSpace: this.deleteOfficeSpace.bind(this),
            changeSlugById: this.changeSlugById.bind(this),
            getPriorityOfficeSpaces: this.getPriorityOfficeSpaces.bind(this),
            addPriorityOfficeSpace: this.addPriorityOfficeSpace.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
            changeProjectOrder: this.changeProjectOrder.bind(this),
            getProjectbyMicrolocationWithPriority: this.getProjectbyMicrolocationWithPriority.bind(this),
            spaceOrderByDrag: this.spaceOrderByDrag.bind(this),
            changeProjectOrderbyDrag: this.changeProjectOrderbyDrag.bind(this)
        }
    }

    async getOfficeSpaces({ limit = 10, sortBy = 'name', orderBy = 1, skip, name, productId, city, micro_location, location, userid, status, building_name }) {
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
            if (micro_location) {
                condition['location.micro_location'] = micro_location;
            }
            if (location) {
                location = '.*' + location + '.*';
                condition['location.name'] = { $regex: new RegExp('^' + location + '$', 'i') };
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
            if (building_name) {
                building_name = building_name.replace(/[^A-Za-z0-9 ]/g, "");
                condition['other_detail.building_name'] = { '$regex': `^(\s+${building_name}|^${building_name})`, '$options': 'i' };
            }
            result.officeSpaces = await OfficeSpace.find(condition)
                .populate('location.city')
                .populate('location.micro_location')
                .populate('images.image')
                .populate('user')
                .populate('building')
                .limit(limit)
                .skip(skip)
                .sort({
                    // [sortBy]: orderBy
                    createdAt: -1
                });
            result.count = await OfficeSpace.countDocuments(condition);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getOfficeSpaceById({ officeSpaceId }) {
        try {
            const officeSpaces = await OfficeSpace.findOne({ _id: officeSpaceId })
                .populate('amenties')
                .populate('images.image')
                .populate('user')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image');
            return officeSpaces;
        } catch (error) {
            throw error;
        }
    }
    async getProjectbyMicrolocationWithPriority({ id }) {

        try {
            const projects = await OfficeSpace.find({
                "location.micro_location": id,
                status: "approve",
                "priority_loc.microlocationId": id,
            })
                .populate("location.city", "name")
                .populate("location.micro_location", "name")
                .populate("images.image")
                // .select("name priority_loc")
                .exec();

            const filteredProjects = projects.filter((otherProject) => {
                return otherProject.priority_loc.some((priority) => {
                    if (
                        priority.microlocationId &&
                        priority.microlocationId.toString() === id
                    ) {
                        return priority.order !== 1000;
                    }
                });
            });
            filteredProjects.sort((a, b) => {
                const priorityA = a.priority_loc.find(
                    (priority) =>
                        priority.microlocationId && priority.microlocationId.toString() === id
                );
                const priorityB = b.priority_loc.find(
                    (priority) =>
                        priority.microlocationId && priority.microlocationId.toString() === id
                );

                return priorityA.order - priorityB.order;
            });
            return filteredProjects;
        } catch (error) {
            throw error;
        }
    };
    async changeProjectOrder({ id, order, is_active, microlocationId }) {
        try {
            const projectToUpdate = await OfficeSpace.findById(id);

            if (!projectToUpdate) {
                throw new Error("Project not found");
            }

            const currentPriority = projectToUpdate.priority_loc.find(
                (priority) =>
                    priority.microlocationId &&
                    priority.microlocationId.toString() === microlocationId &&
                    priority.is_active
            );
            let currentOrder = currentPriority ? currentPriority.order : 1000;
            // Check if the microlocationId exists in projectToUpdate's location
            if (
                !projectToUpdate.location.micro_location.some((micro) =>
                    micro._id.toString().includes(microlocationId)
                )
            ) {
                throw new Error("None of the project match the specified plan types");
            }

            if (is_active === false && order === 1000) {
                projectToUpdate.priority_loc.forEach((priority) => {
                    if (
                        priority.microlocationId &&
                        priority.microlocationId.toString() === microlocationId
                    ) {
                        priority.order = order;
                        priority.is_active = false;
                    }
                });
                await projectToUpdate.save();

                const otherProjects = await OfficeSpace.find({
                    _id: { $ne: id },
                    "location.micro_location": microlocationId,
                    "priority_loc.is_active": true,
                });
                const projectIdsToUpdate = otherProjects.filter((otherProject) => {
                    return otherProject.priority_loc.some((priority) => {
                        if (
                            priority.microlocationId &&
                            priority.microlocationId.toString() === microlocationId
                        ) {
                            return priority.order > currentOrder && priority.order !== 1000;
                        }
                    });
                });
                for (const otherProject of projectIdsToUpdate) {
                    otherProject.priority_loc.forEach((priority) => {
                        if (
                            priority.microlocationId &&
                            priority.microlocationId.toString() === microlocationId
                        ) {
                            priority.order = priority.order - 1;
                        }
                    });

                    otherProject.markModified("priority"); // Mark the field as modified
                    await otherProject.save();
                }
            } else {
                let existingPriorityFound = false;
                projectToUpdate.priority_loc.forEach((priority) => {
                    if (
                        priority.microlocationId &&
                        priority.microlocationId.toString() === microlocationId
                    ) {
                        priority.order = order;
                        priority.is_active = order !== 1000;
                        (priority.microlocationId = microlocationId),
                            (existingPriorityFound = true);
                    }
                });
                if (!existingPriorityFound) {
                    projectToUpdate.priority_loc.push({
                        is_active: is_active,
                        order: order,
                        microlocationId: microlocationId,
                    });
                    projectToUpdate.markModified("priority"); // Mark the field as modified
                }
                await projectToUpdate.save();
            }
        } catch (error) {
            throw error;
        }
    };
    async spaceOrderByDrag({ updatedProjects }) {
        try {
            for (const project of updatedProjects) {
                const { _id, priority } = project;
                // Find the coworking project by its _id and update its priority order
                await OfficeSpace.findByIdAndUpdate(_id, {
                    $set: {
                        "priority.location.order": priority.location.order,
                        "priority.location.is_active": priority.location.order !== 1000,
                    },
                });
            }
        } catch (error) {
            throw error;
        }
    }
    async userofficeSpaces({ officeSpaceId }) {
        try {
            const officeSpaces = await OfficeSpace.findOne({ _id: officeSpaceId })
                .populate('amenties')
                .populate('images.image')
                .populate('user')
                .populate('location.city')
                .populate('location.micro_location')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image');
            return officeSpaces;
        } catch (error) {
            throw error;
        }
    }
    async changeProjectOrderbyDrag({ updatedSpaces }) {
        try {
            for (const project of updatedSpaces) {
                const { _id, priority_loc } = project;

                // Find the project by its _id
                const existingProject = await OfficeSpace.findById(_id);

                // Find the index of the priority object within the priority array
                const priorityIndex = existingProject.priority_loc.findIndex(
                    (p) => p.microlocationId.toString() === priority_loc.microlocationId
                );

                if (priorityIndex !== -1) {
                    // Update the order and is_active fields for the specific priority object
                    existingProject.priority_loc[priorityIndex].order = priority_loc.order;
                    existingProject.priority_loc[priorityIndex].is_active =
                        priority_loc.order !== 1000;

                    // Save the updated project
                    await existingProject.save();
                }
            }
        } catch (error) {
            throw error;
        }
    }

    async createOfficeSpace({
        name,
        builder,
        description,
        space_contact_details,
        building,
        ratings,
        spaceTag,
        images,
        amenties,
        contact_details,
        other_detail,
        social_media,
        location,
        hours_of_operation,
        seo,
        user,
        added_by_user,
        city_name,
        slug
    }) {
        try {
            var expiryDate = new Date();
            expiryDate.setMonth(expiryDate.getMonth() + 3);
            let expireAt = expiryDate;
            let space_type_key = 'office-space/rent';
            const d = new Date();
            let year = d.getFullYear();
            let totalCount = await OfficeSpace.countDocuments();
            let finalCount = totalCount + 1;
            let productId = `CFOS${year}${this.pad(finalCount)}`
            const geometry = this._setGeoLocation(location);
            // const slug = await this._createSlug(null, name, location.name);
            if (user) {
                //space details to official mailId...
                const userDetails = await User.findOne({ _id: user });
                let amentiesDetails;
                let amenties_names = [];
                for (const key in amenties) {
                    amenties_names.push(amenties[key]['name']);
                    amentiesDetails = amenties_names.join(', ')
                }
                let spaceAddress = location.address;
                let available_space = other_detail.area_for_lease_in_sq_ft;
                let expected_monthly_rent = other_detail.rent_in_sq_ft;
                let furnishing_type = other_detail.office_type;
                const getTemplateObject = this._createTemplateObjects({ userDetails, name, available_space, expected_monthly_rent, amentiesDetails, city_name, spaceAddress });
                await aws.sendMail(getTemplateObject.listingParams);
                //space details to leadsquared...
                let lead_id = null;
                const body = this.sanitozeRequestBody({
                    userDetails,
                    name,
                    available_space,
                    expected_monthly_rent,
                    furnishing_type,
                    city_name,
                    spaceAddress,
                });
                // lead_id = await this.leadSquadApiCall(body);

                //space details to excelsheet...
                let landmark = location.landmark;
                let near_metro = location.metro_stop_landmark;
                let img_count = images.length;
                const now = new Date();
                const year = now.getFullYear();
                const month = now.getMonth() + 1; // add 1 because getMonth() returns 0-indexed months
                const day = now.getDate();
                const formattedDate = `${day}-${month}-${year}`;
                if (available_space) {
                    available_space = `${available_space} sq. ft.`
                }
                if (expected_monthly_rent) {
                    expected_monthly_rent = `${expected_monthly_rent}/-per sq. ft.`
                }
                let builder_name;
                const values = [
                    [
                        formattedDate,
                        city_name,
                        'Pending',
                        userDetails.name,
                        userDetails.email,
                        userDetails.phone_number,
                        name,
                        builder_name,
                        available_space,
                        description,
                        expected_monthly_rent,
                        furnishing_type,
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
            return await OfficeSpace.create({
                name,
                builder,
                description,
                space_contact_details,
                ratings,
                spaceTag,
                building,
                images,
                amenties,
                contact_details,
                other_detail,
                social_media,
                location,
                hours_of_operation,
                seo,
                geometry,
                slug,
                user,
                expireAt,
                productId,
                added_by_user,
                space_type_key
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
        available_space,
        expected_monthly_rent,
        furnishing_type,
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
                "Attribute": "mx_Area_Available",
                "Value": +available_space || 0
            },
            {
                "Attribute": "mx_Rent",
                "Value": expected_monthly_rent || ''
            },
            {
                "Attribute": "mx_Furnishing_Type",
                "Value": furnishing_type || 'fully-furnished'
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
                "Value": 'List Office Space'
            },
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
            throw error;
        }
    }

    _createTemplateObjects({ userDetails, name, available_space, expected_monthly_rent, amentiesDetails, city_name, spaceAddress }) {
        let date = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        let visitorsDetail = userDetails.name.toUpperCase() + `<br />`;
        visitorsDetail += userDetails.phone_number + `<br />`;
        visitorsDetail += userDetails.email + `<br />`;
        return {
            listingParams: {
                toEmails: [app.listingEmail],
                templateName: 'office_listing',
                htmlVariables: {
                    centerName: name,
                    available_space: available_space,
                    expected_monthly_rent: expected_monthly_rent,
                    amenties: amentiesDetails,
                    city: city_name,
                    address: spaceAddress,
                    date: date.toLocaleDateString("en-US", options),
                    time: date.toLocaleTimeString('en-US'),
                    visitorsDetail,
                },
                subjectVariables: { userName: userDetails.name, city: city_name, spaceType: 'Office-Space' },
                bccAddresses: [],
                ccAddresses: []
            }
        }
    }

    async updateOfficeSpace({
        id,
        name,
        builder,
        description,
        space_contact_details,
        building,
        ratings,
        spaceTag,
        images,
        amenties,
        contact_details,
        other_detail,
        social_media,
        location,
        hours_of_operation,
        seo,
        added_by_user,
        slug,
        planStatus
    }) {
        try {
            const geometry = this._setGeoLocation(location);
            // const slug = await this._createSlug(id, name, location.name)
            return await OfficeSpace.findOneAndUpdate({ _id: id }, {
                name,
                description,
                space_contact_details,
                ratings,
                spaceTag,
                builder,
                building,
                images,
                amenties,
                contact_details,
                other_detail,
                social_media,
                location,
                hours_of_operation,
                seo,
                geometry,
                slug,
                added_by_user,
                planStatus
            })
        } catch (error) {
            throw error;
        }
    }

    async changeOfficeSpaceStatus({ officeSpaceId, status, planStatus }) {
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
                    "priority.micro_location.order": 1000
                }
            } else {
                updateData = {
                    "status": status,
                }
            }
            if (planStatus) {
                updateData["planStatus"] = planStatus
            }
            return await OfficeSpace.findOneAndUpdate({ _id: officeSpaceId }, { $set: updateData });
        } catch (error) {
            throw error;
        }
    }

    async addPopularOfficeSpaces({ data }) {
        try {
            await OfficeSpace.update({ '_id': data.id }, { $set: { is_popular: data.is_popular } });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    async sortPopularOfficeSpaces({ initialPosition, finalPosition, shiftedId }) {
        try {
            if (initialPosition < finalPosition) {
                await OfficeSpace.updateMany({
                    'is_popular.order': { $lte: finalPosition, $gt: initialPosition },
                    'is_popular.value': true
                }, { $inc: { 'is_popular.order': -1 } })
                await OfficeSpace.updateOne({ _id: shiftedId }, { $set: { 'is_popular.order': finalPosition } })
            }
            if (initialPosition > finalPosition) {
                await OfficeSpace.updateMany({
                    'is_popular.order': { $lt: initialPosition, $gte: finalPosition },
                    'is_popular.value': true
                }, {
                    $inc: { 'is_popular.order': 1 }
                })
                await OfficeSpace.updateOne({
                    _id: shiftedId
                }, {
                    $set: { 'is_popular.order': finalPosition }
                })
            }
        } catch (e) {
            throw (e)
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
                const ws = await OfficeSpace.findOne({ _id: id });
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
            const ws = await OfficeSpace.findOne({ slug: slugName });
            if (ws) {
                slugName = ws.slug + '-' + crypto.randomBytes(2).toString('hex');
            }
            return slugName;
        } catch (error) {
            throw (error);
        }
    }

    async deleteOfficeSpace({ id }) {
        try {
            const os = await OfficeSpace.findOne({ _id: id }).populate('images.image');
            os.images.forEach(async (imageObject) => {
                const folder_name = FileUpload.findFolderFromPath(imageObject.image.s3_link);
                await Image.deleteOne({ _id: imageObject.image._id });
                await FileUtility.deleteFile(imageObject.image.name, folder_name);
            });
            await OfficeSpace.deleteOne({ _id: id });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    async changeSlugById({ id, slug }) {
        try {
            const os = await OfficeSpace.findOne({ slug, _id: { $nin: [id] } });
            if (os) {
                this._throwException('Opps! Slug is already used by another Office space');
            }
            await OfficeSpace.findOneAndUpdate({ _id: id }, { slug });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    async getPriorityOfficeSpaces({ type, city }) {
        try {
            let result = {};
            const priorityType = manageWorkSpaceService._createDynamicPriorityType(type) + '.is_active';
            const priorityTypeOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
            let condition = {
                [priorityType]: true
            };
            result.prioritySpaces = await OfficeSpace.find(condition)
                .populate('location.city')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('seo.open_graph.image')
                .sort({
                    [priorityTypeOrder]: 1
                });
            if (type === 'location') {
                result.prioritySpaces = _.compact(result.prioritySpaces.map(prioritySpace => {
                    if (prioritySpace.priority.location.city == city) {
                        return prioritySpace;
                    }
                }));
            }
            result.count = await OfficeSpace.countDocuments(condition);
            return result;
        } catch (error) {
            throw (error);
        }
    }

    async addPriorityOfficeSpace({ id, type, data }) {
        try {
            let object = manageWorkSpaceService._createDynamicPriorityType(type);
            if (!data.is_active) {
                const { priority } = await OfficeSpace.findOne({ _id: id }, { priority: 1 });
                const priorityOrder = object + '.order';
                const priorityActive = object + '.is_active';
                const condition = {
                    [priorityOrder]: { $gt: priority[type].order },
                    [priorityActive]: true
                };
                if (data.city) {
                    condition['location.city'] = data.city;
                }
                await OfficeSpace.updateMany(condition, {
                    $inc: {
                        [priorityOrder]: -1
                    }
                });
            }
            await OfficeSpace.updateOne({ '_id': id }, {
                $set: {
                    [object]: data
                }
            });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    async setPriorityByType({ initialPosition, finalPosition, shiftedId, type }) {
        try {
            const priorityOrder = manageWorkSpaceService._createDynamicPriorityType(type) + '.order';
            const priorityActive = manageWorkSpaceService._createDynamicPriorityType(type) + '.is_active';
            if (initialPosition < finalPosition) {
                await OfficeSpace.updateMany({
                    [priorityOrder]: { $lte: finalPosition, $gt: initialPosition },
                    [priorityActive]: true
                }, {
                    $inc: {
                        [priorityOrder]: -1
                    }
                })
                await OfficeSpace.updateOne({ _id: shiftedId }, {
                    $set: {
                        [priorityOrder]: finalPosition
                    }
                })
            }
            if (initialPosition > finalPosition) {
                await OfficeSpace.updateMany({
                    [priorityOrder]: { $lt: initialPosition, $gte: finalPosition },
                    [priorityActive]: true
                }, {
                    $inc: {
                        [priorityOrder]: 1
                    }
                })
                await OfficeSpace.updateOne({ _id: shiftedId }, {
                    $set: {
                        [priorityOrder]: finalPosition
                    }
                })
            }
        } catch (e) {
            throw (e)
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

export default new ManageOfficeSpaceService();