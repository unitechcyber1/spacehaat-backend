import models from '../../models/index.js';
import aws from '../../utilities/aws.js';
import axios from 'axios';
import extractSpreadsheetId from "../../utilities/uploadToExcelSheet.js";
import { web_query_sheet } from '../../utilities/queryToExcelSheet.js';
import { google } from 'googleapis';
import app from "../../config/app.js"
import messageService from '../../utilities/messageService.js';
import fs from 'fs';
import dotenv from 'dotenv';
import { virtualOfficeLocations } from '../../utilities/virtualOfficeOptions.js';
dotenv.config();
const Enquiry = models['Enquiry'];
const User = models['User'];
const WorkSpace = models['WorkSpace'];
const OfficeSpace = models['OfficeSpace'];
const CoLivingSpace = models['CoLivingSpace'];
const virtualMessageSid = 'HXc91c227a1383d5ab231a23d6a3d1ef48';
let config = {
    accessKey: 'u$r7267ec7f2823f181e773394b9afda4eb',
    secretKey: 'bfbb04c1f5cb9632286cac53286ad56ddddf6f92',
    apiUrl: 'https://api-in21.leadsquared.com/v2/LeadManagement.svc/Lead.CreateOrUpdate'

}
// const credentials = JSON.parse(fs.readFileSync('website-queries-form-cf8165b3b02a.json'));
// const path = require('path');
// const credentials = path.resolve(__dirname, '../../../website-queries-form-cf8165b3b02a.json');
// const sheets = google.sheets('v4');
// const auth = new google.auth.GoogleAuth({
//     credentials,
//     scopes: ['https://www.googleapis.com/auth/spreadsheets'],
// });
// const sheetsAPI = google.sheets({ version: 'v4', auth });

class ManageEnquiryService {
    constructor() {
        this.axiosConfig = {
            headers: {
                'Content-Type': 'application/json'
            }
        }
        return {
            createEnquiry: this.createEnquiry.bind(this),
            enquiryWithoutLogin: this.enquiryWithoutLogin.bind(this),
            getEnquiriesByUser: this.getEnquiriesByUser.bind(this),
            createLead: this.createLead.bind(this)
        }
    }
    // Helper function to prevent address auto-detection by wrapping segments
    _preventAddressAutoDetection(address) {
        if (!address) return '';
        // Split address by commas and wrap each segment to break pattern detection
        const segments = address.split(',').map(seg => seg.trim());
        return segments.map((segment, index) => {
            // Wrap each segment in a span to break continuous address pattern
            return `<span style="color:#212121 !important;text-decoration:none !important;pointer-events:none !important;" x-apple-data-detectors="false">${segment}</span>${index < segments.length - 1 ? ', ' : ''}`;
        }).join('');
    }

    generateLocationHTML(city) {
        if (!city) {
            console.log('No city provided to generateLocationHTML');
            return '';
        }

        // Normalize city to lowercase to match virtualOfficeLocations keys
        // Handle both string and object cases
        const cityName = typeof city === 'string' ? city : (city.name || city);
        const normalizedCity = cityName ? cityName.toLowerCase().trim() : '';

        const locations = virtualOfficeLocations[normalizedCity] || [];

        if (locations.length === 0) {
            console.log(`No locations found for city: ${cityName} (normalized: ${normalizedCity}). Available cities:`, Object.keys(virtualOfficeLocations));
            return '';
        }

        const listItems = locations.map((loc) => {
            const sanitizedTitle = this._preventAddressAutoDetection(loc.title);
            // Extract price number and format it
            const priceMatch = loc.price.match(/₹([\d,]+)/);
            const priceAmount = priceMatch ? priceMatch[1] : '';
            return `
    <li style="font-size:14px;line-height:22px;color:#212121;margin:8px 0;">
        <span class="location-text" style="color:#212121 !important;text-decoration:none !important;pointer-events:none !important;-webkit-touch-callout:none !important;-webkit-user-select:none !important;-moz-user-select:none !important;-ms-user-select:none !important;user-select:none !important;cursor:default !important;" x-apple-data-detectors="false">${sanitizedTitle}</span> – <span style="color:#212121 !important;text-decoration:none !important;pointer-events:none !important;" x-apple-data-detectors="false">₹${priceAmount} / year</span>
    </li>
  `;
        }).join('');

        return `<ul style="font-size:14px;line-height:22px;color:#212121;margin:10px 0;padding-left:20px;">${listItems}</ul>`;
    }
    makeFirstLetterCapital(city) {
        if (!city) return '';
        return city.charAt(0).toUpperCase() + city.slice(1).toLowerCase();
    }

    getFirstName(fullName) {
        if (!fullName) return '';
        const firstName = fullName.split(' ')[0];
        // Capitalize first letter, rest lowercase
        return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
    }

    async enquiryWithoutLogin({
        email,
        name,
        phone_number,
        interested_in,
        city,
        source = 'PPC',
        mx_Page_Url,
        google_sheet,
        microlocation,
        property_name,
    }) {
        try {
            const user = { email, name, phone_number, requirements };
            const body = this.sanitozeRequestBody({ city, interested_in, user, source, mx_Page_Url });

            //... lead on excelsheet ...//
            let mx_Space_Type;
            let no_of_person;
            let mx_BudgetPrice;
            let mx_Move_In_Date;
            let microlocation;
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1; // add 1 because getMonth() returns 0-indexed months
            const day = now.getDate();
            const formattedDate = `${day}-${month}-${year}`;
            const values = {
                formattedDate,
                city,
                microlocation,
                name: user.name,
                email: user.email,
                phone_number: user.phone_number,
                mx_Space_Type,
                interested_in,
                no_of_person,
                mx_BudgetPrice,
                mx_Move_In_Date,
                mx_Page_Url,
                requirements: user.requirements,
                property_name
            };
            const resource = {
                values,
            };
            if (google_sheet) {
                await this.uploadToExcelsheetForSpace(values, google_sheet);
                //... END EXCEL SHEET CODE ...//
            }

            await this.leadSquadApiCall(body);
            const getTemplateObject = this._createTemplateObjects({ user, interested_in, });
            // await aws.sendMail(getTemplateObject.userParams);
            // await aws.sendMail(getTemplateObject.adminParams);
            return true;
        } catch (error) {
            throw (error);
        }
    }
    pad(n) {
        var s = "000" + n;
        return s.substr(s.length - 4);
    }
    async createEnquiry({
        interested_in,
        email,
        name,
        phone_number,
        no_of_person,
        note,
        work_space,
        office_space,
        living_space,
        id: userId,
        mx_Page_Url,
        mx_BudgetPrice,
        mx_Move_In_Date,
        mx_Space_Type,
        city,
        cityId,
        location,
        address,
        microlocation,
        micro_location,
        google_sheet,
        source,
        property_name,
        rm,
        booking_date,
        isMessageSent = false,
        companyName
    }) {
        try {
            let assignedUsers = [];
            let isOtp = isMessageSent;
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const day = now.getDate();
            const formattedDate = `${day}-${month}-${year}`;
            let totalCount = await Enquiry.countDocuments();
            let finalCount = totalCount + 1;
            let lead_id = `CFL${day}${month}${year}${this.pad(finalCount)}`
            const user = { email, name, phone_number };
            const workSpace = await WorkSpace.findOne({ _id: work_space }).populate('location.city').populate('location.micro_location');
            const officeSpace = await OfficeSpace.findOne({ _id: office_space }).populate('location.city').populate('location.micro_location');
            const livingSpace = await CoLivingSpace.findOne({ _id: living_space }).populate('location.city').populate('location.micro_location');
            const body = this.sanitozeRequestBody({
                user,
                workSpace,
                interested_in,
                no_of_person,
                officeSpace,
                livingSpace,
                mx_Page_Url,
                mx_BudgetPrice,
                mx_Move_In_Date,
                mx_Space_Type,
                city,
                microlocation,
                micro_location,
                source,
                property_name
            });
            //  await this.leadSquadApiCall(body);
            let getTemplateObject = this._createTemplateObjects({ user, workSpace, interested_in, no_of_person, officeSpace, livingSpace, city });
            if (mx_Space_Type === 'Web Coworking' && isMessageSent) {
                await messageService.sendWhatsAppMessage(phone_number, [user.name]);
                await aws.sendMail(getTemplateObject.userParams);
                if (this.isShowNumberBySeats(no_of_person)) {
                    await messageService.sendLeadsOnWhatsApp('+919599993993', [user.name, user.phone_number, user.email, no_of_person, interested_in, city, microlocation, address, mx_Page_Url]);
                }
            };
            if (mx_Space_Type === 'Web Virtual Office' && isMessageSent) {
                await messageService.sendWhatsAppWelcomeForVirtual(phone_number, [user.name], virtualMessageSid);
                await aws.sendMail(getTemplateObject.virtualParams);
                await aws.sendMail(getTemplateObject.virtual_option_Params);
            };
            const values = {
                formattedDate,
                city,
                microlocation,
                micro_location,
                name: user.name,
                email: user.email,
                phone_number: user.phone_number,
                mx_Space_Type,
                interested_in,
                no_of_person,
                mx_BudgetPrice,
                mx_Move_In_Date,
                mx_Page_Url,
                requirements: user.requirements,
                google_sheet,
                // property_name
            };
            if (google_sheet) {
                await this.uploadToExcelsheetForSpace(values, google_sheet);
            };
            const users = await User.find({
                $or: [
                    { role: 'sales' },
                    { roles: { $in: ['sales'] } }
                ]
            });
            users.forEach((item) => {
                // if (!item.google_sheet && !item.sales_contact) {
                //     return;  // 🔴 Skip this user entirely
                // }
                if (item.enquiry) {
                    item.enquiry.forEach((enq) => {
                        if (enq.space === mx_Space_Type) {
                            let shouldUpload = false;
                            let isMarketing = item.isMarketing || false;
                            if (enq.cities && enq.cities.length > 0) {
                                shouldUpload = enq.cities.some((ele) => {
                                    if (ele.city.toLowerCase() === city.toLowerCase()) {
                                        let locationsMatch;
                                        if (mx_Space_Type === 'Web Coliving') {
                                            locationsMatch = !ele.locations || ele.locations.length === 0 ||
                                                location.some(loc => ele.locations.includes(loc));
                                        }
                                        if (mx_Space_Type !== 'Web Coliving') {
                                            locationsMatch = !ele.locations || ele.locations.length === 0 || ele.locations.includes(microlocation);
                                        }
                                        const seatsMatch = !ele.seats || ele.seats.length === 0 || ele.seats.includes(no_of_person);
                                        const colivingTypeMatch = !ele.colivingType || ele.colivingType.length === 0 || ele.colivingType.includes(interested_in);
                                        const workspaceTypeMatch = !ele.workSpaceType || ele.workSpaceType.length === 0 || ele.workSpaceType.includes(interested_in);
                                        const budgetMatch = !ele.budget || ele.budget.length === 0 || ele.budget.includes(mx_BudgetPrice);
                                        if (locationsMatch && seatsMatch && colivingTypeMatch && workspaceTypeMatch && budgetMatch) {
                                            return true;
                                        }
                                    }
                                    return false;
                                });
                            } else {
                                shouldUpload = true;
                            }
                            if (shouldUpload && !isMarketing && item.is_active) {
                                assignedUsers.push(item.id)
                                if (item.google_sheet && name !== 'test') {
                                    this.uploadToExcelsheet(values, item.google_sheet, item.shown_column);
                                }
                                if (this.isShowNumberBySeats(no_of_person) && isMessageSent && item.sales_contact || (mx_Space_Type === 'Web Virtual Office' && isMessageSent)) {
                                    messageService.sendLeadsOnWhatsApp(`+91${item.sales_contact}`, [user.name, user.phone_number, user.email, no_of_person, interested_in, city, microlocation, address, mx_Page_Url]);
                                }
                                if (item.id === '672df1f4d1496fc7c55faaf0') {
                                    this.postLeadToLeadSquared(this.leadData(user.name, user.email, user.phone_number, microlocation), config)
                                }
                            }
                        }
                    });
                }
            });
            const enquiry = await Enquiry.create({
                city,
                microlocation,
                cityId,
                location,
                space_type: mx_Space_Type,
                budget: mx_BudgetPrice,
                no_of_seats: no_of_person,
                page_url: mx_Page_Url,
                rm,
                assignedUsers,
                isOtp,
                address,
                lead_id,
                booking_date,
                interested_in,
                no_of_person,
                note,
                work_space,
                companyName,
                user: userId || null,
                office_space,
                living_space,
                other_info: {
                    email,
                    name,
                    phone_number,
                }
            });
            // await aws.sendMail(getTemplateObject.adminParams);
            return enquiry;
        } catch (error) {
            throw (error);
        }
    }

    async postLeadToLeadSquared(leadData, config) {
        const {
            accessKey,
            secretKey,
            apiUrl = 'https://api-in21.leadsquared.com/v2/LeadManagement.svc/Lead.CreateOrUpdate'
        } = config;

        const payload = Object.entries(leadData).map(([key, value]) => ({
            Attribute: key,
            Value: value
        }));

        try {
            const response = await axios.post(apiUrl, payload, {
                params: {
                    accessKey,
                    secretKey
                },
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            const errorData = error.response?.data || { message: error.message || 'Unknown error' };
            console.error('LeadSquared API Error:', errorData);
            return {
                success: false,
                error: errorData
            };
        }
    }
    leadData(name, email, phone, location) {
        return {
            FirstName: name,
            EmailAddress: email,
            Phone: phone,
            Source: 'Cofynd',
            mx_Location_Preference: location,
        }
    }

    isShowNumberBySeats(noOfSeats) {
        if (noOfSeats === '11-20') {
            return true;
        }
        else if (noOfSeats === '20-50') {
            return true;
        }
        else if (noOfSeats === '50-100') {
            return true;
        }
        else if (noOfSeats === '100+') {
            return true;
        }
        else {
            return false;
        }
    }

    buildValuesToUpdate(resource, flags) {
        let time = new Date().toLocaleTimeString()
        const valuesToUpdate = [
            [
                resource.city.charAt(0).toUpperCase() + resource.city.slice(1),
                flags.location ? (resource.micro_location || resource.microlocation) : undefined,
                // resource.property_name ? resource.property_name : undefined,
                flags.dateTime ? resource.formattedDate : undefined,
                time,
                resource.name,
                resource.email,
                resource.phone_number,
                (flags.budget ? resource.mx_BudgetPrice : undefined) || (flags.seats ? resource.no_of_person : undefined),
                flags.interestedIn ? resource.interested_in : undefined,
                flags.pageUrl ? resource.mx_Page_Url : undefined,
                flags.space_type ? resource.mx_Space_Type : undefined
            ].filter(value => value !== undefined)
        ];
        return valuesToUpdate;
    }
    //... upload to excel sheet function ...//
    async uploadToExcelsheet(resource, google_sheet, flags) {
        const sheetLink = google_sheet;
        let time = new Date().toLocaleTimeString()
        const valuesToUpdate = this.buildValuesToUpdate(resource, flags)
        const spreadsheetId = extractSpreadsheetId(sheetLink);
        const range = 'A1';
        await web_query_sheet.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: valuesToUpdate },
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
    async uploadToExcelsheetForSpace(resource, google_sheet) {
        const sheetLink = google_sheet;
        let time = new Date().toLocaleTimeString()
        const valuesToUpdate = [
            [
                resource.city.charAt(0).toUpperCase() + resource.city.slice(1),
                resource.micro_location || resource.microlocation,
                // resource.property_name ? resource.property_name : 'NA',
                resource.formattedDate,
                time,
                resource.name,
                resource.email,
                resource.phone_number,
                resource.mx_BudgetPrice || resource.no_of_person,
                resource.interested_in,
            ],
        ];
        const spreadsheetId = extractSpreadsheetId(sheetLink);
        const range = 'A1';
        await web_query_sheet.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: valuesToUpdate },
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

    async createLead({
        user, interested_in, city, microlocation, mx_Page_Url, mx_BudgetPrice, mx_Furnishing_Type, mx_Office_Type, no_of_person, mx_Space_Type, source, google_sheet, property_name, cityId,
        location, rm, userId, note, address, booking_date
    }) {
        try {
            const body = this.sanitozeRequestBody({ user, interested_in, city, microlocation, mx_Page_Url, mx_BudgetPrice, mx_Furnishing_Type, mx_Office_Type, no_of_person, mx_Space_Type, source, google_sheet });

            //... lead on excelsheet ...//
            let mx_Move_In_Date;
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1; // add 1 because getMonth() returns 0-indexed months
            const day = now.getDate();
            let totalCount = await Enquiry.countDocuments();
            let finalCount = totalCount + 1;
            let lead_id = `CFL${day}${month}${year}${this.pad(finalCount)}`
            const formattedDate = `${day}-${month}-${year}`;
            const values = {
                formattedDate,
                city,
                microlocation,
                name: user.name,
                email: user.email,
                phone_number: user.phone_number,
                mx_Space_Type,
                interested_in,
                no_of_person,
                mx_BudgetPrice,
                mx_Move_In_Date,
                mx_Page_Url,
                requirements: user.requirements,
                // property_name
            };
            const resource = {
                values,
            };
            if (google_sheet) {
                await this.uploadToExcelsheetForSpace(values, google_sheet);
                //... END EXCEL SHEET CODE ...//
            }
            const users = await User.find({
                $or: [
                    { role: 'sales' },
                    { roles: { $in: ['sales'] } }
                ]
            });
            users.forEach((item) => {
                if (item.google_sheet && item.enquiry) {
                    item.enquiry.forEach((enq) => {
                        if (enq.space === mx_Space_Type) {
                            let shouldUpload = false;
                            if (enq.cities && enq.cities.length > 0) {
                                shouldUpload = enq.cities.some((ele) => {
                                    if (ele.city === city) {
                                        let locationsMatch;
                                        if (mx_Space_Type === 'Web Coliving') {
                                            locationsMatch = !ele.locations || ele.locations.length === 0 ||
                                                location.some(loc => ele.locations.includes(loc));
                                        }
                                        if (mx_Space_Type !== 'Web Coliving') {
                                            locationsMatch = !ele.locations || ele.locations.length === 0 || ele.locations.includes(microlocation);
                                        }
                                        const seatsMatch = !ele.seats || ele.seats.length === 0 || ele.seats.includes(no_of_person);
                                        const colivingTypeMatch = !ele.colivingType || ele.colivingType.length === 0 || ele.colivingType.includes(interested_in);
                                        const workspaceTypeMatch = !ele.workSpaceType || ele.workSpaceType.length === 0 || ele.workSpaceType.includes(interested_in);
                                        const budgetMatch = !ele.budget || ele.budget.length === 0 || ele.budget.includes(mx_BudgetPrice);
                                        if (locationsMatch && seatsMatch && colivingTypeMatch && workspaceTypeMatch && budgetMatch) {
                                            return true;
                                        }
                                    }
                                    return false;
                                });
                            } else {
                                shouldUpload = true;
                            }
                            if (shouldUpload) {
                                this.uploadToExcelsheet(values, item.google_sheet, item.shown_column);
                            }
                        }
                    });
                }
            });
            const enquiry = await Enquiry.create({
                city,
                microlocation,
                cityId,
                location,
                space_type: mx_Space_Type,
                budget: mx_BudgetPrice,
                no_of_seats: no_of_person,
                page_url: mx_Page_Url,
                rm,
                address,
                lead_id,
                interested_in,
                no_of_person,
                note,
                user: userId || null,
                other_info: user,
                booking_date
            });
            // return await this.leadSquadApiCall(body);
        } catch (error) {
            throw (error)
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

    async leadSquadOpportunityManagementApiCall(body) {
        try {
            let lead_id = null;
            const response = await axios.post(
                `${app.leadSquaredUrl}OpportunityManagement.svc/Capture?accessKey=u$r455297ea39e8318d5fbc79136360e24d&secretKey=2fa22cab320e8673c1d9db868fbe02d753e48eda`,
                body,
                this.axiosConfig
            );
            if (response.data && response.data.Status == 0) {
                lead_id = response.data.CreatedOpportunityId;
                console.log("success response", response.data);
                console.log("Success CreatedOpportunityId", lead_id);
            } else {
                console.log(response.data.ExceptionMessage);
            }
            return lead_id;
        } catch (error) {
            console.log(error);
        }
    }

    async getEnquiriesByUser({
        limit = 10,
        sortBy = 'no_of_person',
        orderBy = 1,
        skip
    }, { id: userId }) {
        try {
            const enquiries = await Enquiry.find({ user: userId })
                .populate({
                    path: 'work_space',
                    select: 'images _id location name',
                    populate: {
                        path: 'images.image'
                    }
                })
                .populate({
                    path: 'office_space',
                    select: 'images _id location name',
                    populate: {
                        path: 'images.image'
                    }
                })
                .limit(limit)
                .skip(skip)
                .sort({
                    [sortBy]: orderBy
                });
            return enquiries;
        } catch (error) {
            throw (error);
        }
    }

    sanitozeRequestBodyOpportunityManagement({
        user,
        workSpace,
        interested_in,
        no_of_person,
        mx_Office_Type,
        officeSpace,
        livingSpace,
        city,
        microlocation,
        source = "Organic",
        mx_Page_Url,
        mx_BudgetPrice,
        mx_Furnishing_Type,
        mx_Move_In_Date,
        mx_Space_Type
    }) {
        try {
            let OpportunityEventCode;
            if (mx_Space_Type == 'Web Coworking') {
                OpportunityEventCode = 12001;
            }
            if (mx_Space_Type == 'Web Coliving') {
                OpportunityEventCode = 12002;
            }
            const object = this._createCenterUrl(workSpace, officeSpace, livingSpace);
            const resposne = {
                "LeadDetails": [
                    {
                        "Attribute": "ProspectID",
                        "Value": "4d03f397-49e7-4e4e-8168-5f51d591c592"
                    },
                    {
                        "Attribute": "SearchBy",
                        "Value": "ProspectId"
                    },
                    {
                        "Attribute": "__UseUserDefinedGuid__",
                        "Value": "true"
                    },
                    {
                        "Attribute": "EmailAddress",
                        "Value": user.email || 'NA'
                    },
                    {
                        "Attribute": "FirstName",
                        "Value": user.name || 'NA'
                    },
                    {
                        "Attribute": "Phone",
                        "Value": user.phone_number || '9715876567'
                    },
                    {
                        "Attribute": "Company",
                        "Value": user.org_name || null
                    },
                    {
                        "Attribute": "mx_Additonal_Requirements",
                        "Value": user.requirements || null
                    },
                    {
                        "Attribute": "mx_Square_Feet",
                        "Value": user.area_sqft || null
                    },
                    {
                        "Attribute": "mx_interestedIn",
                        "Value": interested_in || 'NA'
                    },
                    {
                        "Attribute": "mx_Space_Type",
                        "Value": mx_Space_Type || 'NA'
                    },
                    {
                        "Attribute": "mx_Page_Url",
                        "Value": mx_Page_Url || 'NA'
                    },
                    {
                        "Attribute": "mx_BudgetPrice",
                        "Value": mx_BudgetPrice || ''
                    },
                    {
                        "Attribute": "mx_Furnishing_Type",
                        "Value": mx_Furnishing_Type || 'NA'
                    },
                    {
                        "Attribute": "mx_Move_In_Date",
                        "Value": mx_Move_In_Date || null
                    },
                    {
                        "Attribute": "mx_visitDate",
                        "Value": new Date() || null
                    },
                    {
                        "Attribute": "mx_No_of_Seats",
                        "Value": no_of_person || null
                    },
                    {
                        "Attribute": "mx_City",
                        "Value": object.city || city || 'No City (Generic)'
                    },
                    {
                        "Attribute": "mx_Micro_Location",
                        "Value": object.microlocation || microlocation || 'No Microlocation (Generic)'
                    },
                    {
                        "Attribute": "mx_URL",
                        "Value": object.url || null
                    },
                    {
                        "Attribute": "Source",
                        "Value": source
                    }
                ],
                "Opportunity": {
                    "OpportunityEventCode": OpportunityEventCode,
                    "OpportunityNote": "Opportunity capture api overwrite",
                    "UpdateEmptyFields": true,
                    "DoNotPostDuplicateActivity": true,
                    "DoNotChangeOwner": true,
                    "Fields": [
                        {
                            "SchemaName": "mx_Custom_1",
                            "Value": "Opportunity-Test"
                        },
                        {
                            "SchemaName": "mx_Custom_2",
                            "Value": "Prospecting"
                        },
                        {
                            "SchemaName": "mx_Custom_5",
                            "Value": "Prospecting"
                        },
                        {
                            "SchemaName": "Status",
                            "Value": "Open"
                        }
                    ]
                }
            }
            return resposne;
        } catch (error) {
            throw (error);
        }
    }

    sanitozeRequestBody({
        user,
        workSpace,
        interested_in,
        no_of_person,
        mx_Office_Type,
        officeSpace,
        livingSpace,
        city,
        microlocation,
        source,
        mx_Page_Url,
        mx_BudgetPrice,
        mx_Furnishing_Type,
        mx_Move_In_Date,
        mx_Space_Type
    }) {
        try {
            if (!source) {
                source = "Organic"
            }
            const object = this._createCenterUrl(workSpace, officeSpace, livingSpace);
            const resposne = [
                {
                    "Attribute": "EmailAddress",
                    "Value": user.email || 'NA'
                },
                {
                    "Attribute": "FirstName",
                    "Value": user.name || 'NA'
                },
                {
                    "Attribute": "Phone",
                    "Value": user.phone_number || '9715876567'
                },
                {
                    "Attribute": "Company",
                    "Value": user.org_name || null
                },
                {
                    "Attribute": "mx_Additonal_Requirements",
                    "Value": user.requirements || null
                },
                {
                    "Attribute": "mx_Square_Feet",
                    "Value": user.area_sqft || null
                },
                {
                    "Attribute": "mx_interestedIn",
                    "Value": interested_in || 'NA'
                },
                {
                    "Attribute": "mx_Space_Type",
                    "Value": mx_Space_Type || 'NA'
                },
                {
                    "Attribute": "mx_Page_Url",
                    "Value": mx_Page_Url || 'NA'
                },
                {
                    "Attribute": "mx_BudgetPrice",
                    "Value": mx_BudgetPrice || ''
                },
                {
                    "Attribute": "mx_Furnishing_Type",
                    "Value": mx_Furnishing_Type || 'NA'
                },
                {
                    "Attribute": "mx_Move_In_Date",
                    "Value": mx_Move_In_Date || null
                },
                {
                    "Attribute": "mx_visitDate",
                    "Value": new Date() || null
                },
                {
                    "Attribute": "mx_No_of_Seats",
                    "Value": no_of_person || null
                },
                {
                    "Attribute": "mx_City",
                    "Value": object.city || city || 'No City (Generic)'
                },
                {
                    "Attribute": "mx_Micro_Location",
                    "Value": object.microlocation || microlocation || 'No Microlocation (Generic)'
                },
                {
                    "Attribute": "mx_URL",
                    "Value": object.url || null
                },
                {
                    "Attribute": "Source",
                    "Value": source
                }
            ];
            return resposne;
        } catch (error) {
            throw (error);
        }
    }

    _createTemplateObjects({ user, workSpace, interested_in, no_of_person, officeSpace, livingSpace, city }) {
        let date = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        let visitorsDetail = user.name.toUpperCase() + `<br />`;
        visitorsDetail += user.phone_number + `<br />`;
        visitorsDetail += user.email + `<br />`;
        const object = this._createCenterUrl(workSpace, officeSpace, livingSpace);
        return {
            userParams: {
                toEmails: [user.email],
                templateName: 'enquiry',
                htmlVariables: {
                    name: user.name.toUpperCase(),
                    centerName: workSpace && `${workSpace.name} ${workSpace.location.name}` || officeSpace && officeSpace.name || livingSpace && livingSpace.name || `Random Search on ${interested_in}`,
                    centerUrl: object.url || 'Random Search By Enquiry Form'
                },
                bccAddresses: [],
                ccAddresses: []
            },
            virtualParams: {
                toEmails: [user.email],
                templateName: 'virtual_office_welcome',
                htmlVariables: {
                    name: user.name.toUpperCase(),
                },
                bccAddresses: [],
                ccAddresses: []
            },
            virtual_option_Params: {
                toEmails: [user.email],
                templateName: 'virtual_office_options',
                htmlVariables: {
                    name: this.getFirstName(user.name),
                    city: this.makeFirstLetterCapital(city),
                    location_blocks: this.generateLocationHTML(city)
                },
                subjectVariables: {
                    city: this.makeFirstLetterCapital(city)
                },
                bccAddresses: [],
                ccAddresses: []
            },
            adminParams: {
                toEmails: [app.adminEmail],
                templateName: 'adminEnquiry',
                htmlVariables: {
                    interested_in: interested_in || 'Office Space',
                    centerName: workSpace && `${workSpace.name} ${workSpace.location.name}` || officeSpace && officeSpace.name || livingSpace && livingSpace.name || `Random Search on ${interested_in}`,
                    date: date.toLocaleDateString("en-US", options),
                    time: date.toLocaleTimeString('en-US'),
                    visitorsDetail,
                    visitors: no_of_person || 'Not Application for this enquiry',
                    centerUrl: object.url || 'Random Search By Enquiry Form'
                },
                subjectVariables: { userName: user.name.toUpperCase() },
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
}
export default new ManageEnquiryService();