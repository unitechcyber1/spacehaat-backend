import models from '../../models/index.js';
import manageWorkSpaceService from './manage-work-space.js';
import crypto from 'crypto';
import FileUtility from '../../utilities/file.js';
import { findCountryByCoordinate } from "country-locator";
import aws from '../../utilities/aws.js';
import app from '../../config/app.js'
import axios from 'axios';
import {getCountry} from 'country-currency-map';
import FileUpload from '../../controllers/common/fileUpload.js'
// import { sheets } from '../../utilities/uploadToExcelSheet.js';
const spreadsheetId = "1uwiOeDkq4Bq596adnXC5bfE7SWFyscrLNcQOv7vVdqc";
const range = "Coliving!A2:C2"; // Update row 2 in Sheet1
import { web_query_sheet } from '../../utilities/queryToExcelSheet.js';
const Country = models['Country'];
const MicroLocation = models['MicroLocation'];
const CoLivingSpace = models['CoLivingSpace'];
const Image = models['Image'];
const User = models['User'];



class ManageCoLivingSpaceService {
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
            getCoLivingSpaces: this.getCoLivingSpaces.bind(this),
            getCoLivingSpaceById: this.getCoLivingSpaceById.bind(this),
            getUserCoLivingSpaceById: this.getUserCoLivingSpaceById.bind(this),
            createCoLivingSpace: this.createCoLivingSpace.bind(this),
            updateCoLivingSpace: this.updateCoLivingSpace.bind(this),
            // addPopularCoLivingSpaces: this.addPopularCoLivingSpaces.bind(this),
            // sortPopularCoLivingSpaces: this.sortPopularCoLivingSpaces.bind(this),
            addPriorityCoLivingSpace: this.addPriorityCoLivingSpace.bind(this),
            setPriorityByType: this.setPriorityByType.bind(this),
            changeCoLivingSpaceStatus: this.changeCoLivingSpaceStatus.bind(this),
            deleteCoLivingSpace: this.deleteCoLivingSpace.bind(this),
            changeSlugById: this.changeSlugById.bind(this),
            spaceOrderByDrag: this.spaceOrderByDrag.bind(this),
            changeProjectOrder: this.changeProjectOrder.bind(this),
            getProjectbyMicrolocationWithPriority: this.getProjectbyMicrolocationWithPriority.bind(this),
            changeProjectOrderbyDrag: this.changeProjectOrderbyDrag.bind(this)
        }
    }

    async getCoLivingSpaces({ limit = 10, sortBy = 'name', orderBy = 1, skip, name,productId, city, location, micro_location, shouldApprove = false, userid, status }) {
        try {
            let result = {};
            let condition = {};
            if (name) {
                /** TODO $text search will be implemented */
                name = name.replace(/[^A-Za-z0-9 ]/g, "");
                condition['name'] = { '$regex': `^(\s+${name}|^${name})`, '$options': 'i' };
            }
            if(productId){
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
            if (shouldApprove) {
                condition['status'] = 'approve';
                condition['is_active'] = true;
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

            result.coLivingSpaces = await CoLivingSpace.find(condition)
                .populate('location.micro_location')
                .populate('location.city')
                .populate('location.country')
                .populate('images.image')
                .populate('user')
                .limit(limit)
                .skip(skip)
                .sort({
                    // [sortBy]: orderBy
                    createdAt: -1
                });
            result.count = await CoLivingSpace.countDocuments(condition);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getCoLivingSpaceById({ coLivingSpaceId }) {
        try {
            const coLivingSpaces = await CoLivingSpace.findOne({ _id: coLivingSpaceId })
                .populate('amenties')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('user')
                .populate('seo.open_graph.image')
                .populate('sleepimg');
            return coLivingSpaces;
        } catch (error) {
            throw error;
        }
    }

    async getUserCoLivingSpaceById({ coLivingSpaceId }) {
        try {
            const coLivingSpaces = await CoLivingSpace.findOne({ _id: coLivingSpaceId })
                .populate('amenties')
                .populate('images.image')
                .populate('seo.twitter.image')
                .populate('user')
                .populate('location.city')
                .populate('location.micro_location')
                .populate('coliving_plans.planId')
                .populate('seo.open_graph.image')
                .populate('sleepimg');
            return coLivingSpaces;
        } catch (error) {
            throw error;
        }
    }

    async createCoLivingSpace({
        name,
        description,
        images,
        ratings,
        spaceTag,
        slug,
        amenties,
        other_detail,
        social_media,
        location,
        hours_of_operation,
        seo,
        coliving_plans,
        brand,
        sleepimg,
        user,
        added_by_user,
        bed_types,
        city_name,
        space_contact_details
    }) {
        try {
            var expiryDate = new Date();
            var geometry;
            let finalSlug;
            expiryDate.setMonth(expiryDate.getMonth() + 3);
            let expireAt = expiryDate;
            let space_type_key = 'co-living';
            const d = new Date();
            let year = d.getFullYear();
            let totalCount = await CoLivingSpace.countDocuments();
            let finalCount = totalCount + 1;
            let productId = `CFCL${year}${this.pad(finalCount)}`
            if (location && location.latitude && location.longitude) {
                const countryInfo = findCountryByCoordinate(+location.latitude, +location.longitude);
                let country_name = countryInfo.name;
                let currency_code = getCountry(country_name).currency;
                geometry = this._setGeoLocation(location);
            }
            if(user){
                finalSlug = await this._createSlug(null, name, location.name);
            }
            else{
                finalSlug = slug; 
            }
            
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
                let spaceAddress = location.address;
                let no_of_beds = other_detail.beds;
                const getTemplateObject = this._createTemplateObjects({ userDetails, name, no_of_beds, bed_types, amentiesDetails, city_name, spaceAddress });
                await aws.sendMail(getTemplateObject.listingParams);

                //space details to leadsquared...
                let lead_id = null;
                const body = this.sanitozeRequestBody({
                    userDetails,
                    name,
                    no_of_beds,
                    bed_types,
                    city_name,
                    spaceAddress,
                });
                // lead_id = await this.leadSquadApiCall(body);

                //space details to excelsheet...
                let landmark = location.landmark;
                let near_metro = location.metro_stop_landmark;
                let img_count = images.length;
                let private_room_amount;
                let double_sharing_amount;
                let triple_sharing_amount;
                let delux_room_amount;
                let _4bed_sharing_amount;
                let _1bhk_amount;
                let _2bhk_amount;
                let _3bhk_amount;
                let _1rk_amount;
                const now = new Date();
                const year = now.getFullYear();
                const month = now.getMonth() + 1; // add 1 because getMonth() returns 0-indexed months
                const day = now.getDate();
                const formattedDate = `${day}-${month}-${year}`;
                for (let index = 0; index < coliving_plans.length; index++) {
                    if (coliving_plans[index].planId == '625698d3a91948671a4c590b') {
                        private_room_amount = `${coliving_plans[index]['price']} per/${coliving_plans[index]['duration']}`
                    }
                    if (coliving_plans[index].planId == '625698e8a91948671a4c590c') {
                        double_sharing_amount = `${coliving_plans[index]['price']} per/${coliving_plans[index]['duration']}`
                    }
                    if (coliving_plans[index].planId == '625698f4a91948671a4c590d') {
                        triple_sharing_amount = `${coliving_plans[index]['price']} per/${coliving_plans[index]['duration']}`
                    }
                    if (coliving_plans[index].planId == '6257ee3c6f4f5e6a7a1b04de') {
                        delux_room_amount = `${coliving_plans[index]['price']} per/${coliving_plans[index]['duration']}`
                    }
                    if (coliving_plans[index].planId == '6267e6e3ad0b2760e3a9cf3d') {
                        _4bed_sharing_amount = `${coliving_plans[index]['price']} per/${coliving_plans[index]['duration']}`
                    }
                    if (coliving_plans[index].planId == '628766ace0847773482d6ac0') {
                        _1bhk_amount = `${coliving_plans[index]['price']} per/${coliving_plans[index]['duration']}`
                    }
                    if (coliving_plans[index].planId == '628766b5e0847773482d6ac1') {
                        _2bhk_amount = `${coliving_plans[index]['price']} per/${coliving_plans[index]['duration']}`
                    }
                    if (coliving_plans[index].planId == '628766bde0847773482d6ac2') {
                        _3bhk_amount = `${coliving_plans[index]['price']} per/${coliving_plans[index]['duration']}`
                    }
                    if (coliving_plans[index].planId == '62876febe0847773482d6b16') {
                        _1rk_amount = `${coliving_plans[index]['price']} per/${coliving_plans[index]['duration']}`
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
                        no_of_beds,
                        description,
                        private_room_amount,
                        double_sharing_amount,
                        triple_sharing_amount,
                        delux_room_amount,
                        _4bed_sharing_amount,
                        _1bhk_amount,
                        _2bhk_amount,
                        _3bhk_amount,
                        _1rk_amount,
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
            return await CoLivingSpace.create({
                name,
                description,
                currency_code,
                country_dbname,
                images,
                ratings,
                spaceTag,
                amenties,
                other_detail,
                social_media,
                location,
                hours_of_operation,
                seo,
                geometry,
                slug: finalSlug,
                coliving_plans,
                brand,
                sleepimg,
                user,
                expireAt,
                productId,
                added_by_user,
                space_type_key,
                space_contact_details
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
        no_of_beds,
        bed_types,
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
                    "Attribute": "mx_Number_of_Bed",
                    "Value": +no_of_beds || 0
                },
                {
                    "Attribute": "mx_Type_of_Bed",
                    "Value": bed_types || ''
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
                    "Value": 'List Coliving'
                },
                // {
                //     "Attribute": "RelatedCompanyIdName",
                //     "Value": 'ListingSpace'
                // }
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

    _createTemplateObjects({ userDetails, name, no_of_beds, bed_types, amentiesDetails, city_name, spaceAddress }) {
        let date = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        let visitorsDetail = userDetails.name.toUpperCase() + `<br />`;
        visitorsDetail += userDetails.phone_number + `<br />`;
        visitorsDetail += userDetails.email + `<br />`;
        return {
            listingParams: {
                toEmails: [app.listingEmail],
                templateName: 'coliving_listing',
                htmlVariables: {
                    centerName: name,
                    no_of_beds: no_of_beds,
                    bed_types: bed_types,
                    amenties: amentiesDetails,
                    city: city_name,
                    address: spaceAddress,
                    date: date.toLocaleDateString("en-US", options),
                    time: date.toLocaleTimeString('en-US'),
                    visitorsDetail,
                },
                subjectVariables: { userName: userDetails.name, city: city_name, spaceType: 'Co-living' },
                bccAddresses: [],
                ccAddresses: []
            }
        }
    }

    async updateCoLivingSpace({
        id,
        name,
        description,
        images,
        ratings,
        spaceTag,
        amenties,
        other_detail,
        social_media,
        location,
        seo,
        coliving_plans,
        brand,
        sleepimg,
        added_by_user,
        space_contact_details,
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
            return await CoLivingSpace.findOneAndUpdate({ _id: id }, {
                name,
                description,
                currency_code,
                country_dbname,
                images,
                ratings,
                spaceTag,
                amenties,
                other_detail,
                social_media,
                location,
                seo,
                geometry,
                slug,
                coliving_plans,
                brand,
                sleepimg,
                added_by_user,
                space_contact_details,
                planStatus
            })
        } catch (error) {
            throw error;
        }
    }

    async changeCoLivingSpaceStatus({ coLivingSpaceId, status, planStatus }) {
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
            if(planStatus){
                updateData["planStatus"] = planStatus;
            }
            
            return await CoLivingSpace.findOneAndUpdate({ _id: coLivingSpaceId }, { $set: updateData });
        } catch (error) {
            throw error;
        }
    }

    // async addPopularCoLivingSpaces({ data }) {
    //     try {
    //         await OfficeSpace.update({ '_id': data.id }, { $set: { is_popular: data.is_popular } });
    //         return true;
    //     } catch (error) {
    //         throw (error);
    //     }
    // }

    // async sortPopularCoLivingSpaces({ initialPosition, finalPosition, shiftedId }) {
    //     try {
    //         if (initialPosition < finalPosition) {
    //             await OfficeSpace.updateMany(
    //                 {
    //                     'is_popular.order': { $lte: finalPosition, $gt: initialPosition },
    //                     'is_popular.value': true
    //                 },
    //                 { $inc: { 'is_popular.order': -1 } }
    //             )
    //             await OfficeSpace.updateOne(
    //                 { _id: shiftedId },
    //                 { $set: { 'is_popular.order': finalPosition } }
    //             )
    //         }
    //         if (initialPosition > finalPosition) {
    //             await OfficeSpace.updateMany({
    //                 'is_popular.order': { $lt: initialPosition, $gte: finalPosition },
    //                 'is_popular.value': true
    //             },
    //                 {
    //                     $inc: { 'is_popular.order': 1 }
    //                 }
    //             )
    //             await OfficeSpace.updateOne({
    //                 _id: shiftedId
    //             }, {
    //                 $set: { 'is_popular.order': finalPosition }
    //             })
    //         }
    //     } catch (e) {
    //         throw (e)
    //     }
    // }

    async addPriorityCoLivingSpace({ id, type, data }) {
        try {
            let object = manageWorkSpaceService._createDynamicPriorityType(type);
            if (!data.is_active) {
                const { priority } = await CoLivingSpace.findOne({ _id: id }, { priority: 1 });
                const priorityOrder = object + '.order';
                const priorityActive = object + '.is_active';
                const condition = {
                    [priorityOrder]: { $gt: priority[type].order },
                    [priorityActive]: true
                };
                if (data.city) {
                    condition['location.city'] = data.city;
                }
                await CoLivingSpace.updateMany(condition, {
                    $inc: {
                        [priorityOrder]: -1
                    }
                });
            }
            await CoLivingSpace.updateOne({ '_id': id }, {
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
                await CoLivingSpace.updateMany({
                    [priorityOrder]: { $lte: finalPosition, $gt: initialPosition },
                    [priorityActive]: true
                }, {
                    $inc: {
                        [priorityOrder]: -1
                    }
                })
                await CoLivingSpace.updateOne({ _id: shiftedId }, {
                    $set: {
                        [priorityOrder]: finalPosition
                    }
                })
            }
            if (initialPosition > finalPosition) {
                await CoLivingSpace.updateMany({
                    [priorityOrder]: { $lt: initialPosition, $gte: finalPosition },
                    [priorityActive]: true
                }, {
                    $inc: {
                        [priorityOrder]: 1
                    }
                })
                await CoLivingSpace.updateOne({ _id: shiftedId }, {
                    $set: {
                        [priorityOrder]: finalPosition
                    }
                })
            }
        } catch (e) {
            throw (e)
        }
    }

    async spaceOrderByDrag ({updatedProjects}) {
        try {
          for (const project of updatedProjects) {
            const { _id, priority } = project;
            // Find the coworking project by its _id and update its priority order
            await CoLivingSpace.findByIdAndUpdate(_id, {
              $set: {
                "priority.location.order": priority.location.order,
                "priority.location.is_active": priority.location.order !== 1000,
              },
            });
          }
        } catch (error) {
          throw error
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
                const ws = await CoLivingSpace.findOne({ _id: id });
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
            const ws = await CoLivingSpace.findOne({ slug: slugName });
            if (ws) {
                slugName = ws.slug + '-' + crypto.randomBytes(2).toString('hex');
            }
            return slugName;
        } catch (error) {
            throw (error);
        }
    }

    async deleteCoLivingSpace({ id }) {
        try {
            const os = await CoLivingSpace.findOne({ _id: id }).populate('images.image');
            os && os.images.forEach(async(imageObject) => {
                const folder_name = FileUpload.findFolderFromPath(imageObject.image.s3_link);
                await Image.deleteOne({ _id: imageObject.image._id });
                await FileUtility.deleteFile(imageObject.image.name, folder_name);
            });
            await CoLivingSpace.deleteOne({ _id: id });
            return true;
        } catch (error) {
            throw (error);
        }
    }

    async changeSlugById({ id, slug }) {
        try {
            const os = await CoLivingSpace.findOne({ slug, _id: { $nin: [id] } });
            if (os) {
                this._throwException('Opps! Slug is already used by another Co-Living space');
            }
            await CoLivingSpace.findOneAndUpdate({ _id: id }, { slug });
            return true;
        } catch (error) {
            throw (error);
        }
    }
    async changeProjectOrder ({id, order, is_active, microlocationId}) {
        try {
          const projectToUpdate = await CoLivingSpace.findById(id);
            
          if (!projectToUpdate) {
            throw new Error('Project not found')
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
            throw new Error('None of the project match the specified plan types')
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
      
            const otherProjects = await CoLivingSpace.find({
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
            throw error
        }
      };

      async getProjectbyMicrolocationWithPriority ({id}) {
      
        try {
          const projects = await CoLivingSpace.find({
            "location.micro_location": id,
             status: "approve",
            "priority_loc.microlocationId": id,
          })
            .populate("location.city", "name")
            .populate("location.micro_location", "name")
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
      async changeProjectOrderbyDrag ({updatedSpaces}) {
        try {
          for (const project of updatedSpaces) {
            const { _id, priority_loc } = project;
      
            // Find the project by its _id
            const existingProject = await CoLivingSpace.findById(_id);
      
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

export default new ManageCoLivingSpaceService();