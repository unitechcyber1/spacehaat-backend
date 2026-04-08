import models from '../../models/index.js';
import { Parser as Json2CsvParser } from 'json2csv';
import { getFieldNames } from '../../utilities/uploadToExcelSheet.js';
import { ObjectId } from 'mongodb';
import moment from 'moment';
import messageService from '../../utilities/messageService.js';
import aws from '../../utilities/aws.js';
const Enquiry = models['Enquiry']
const User = models['User']
const WorkSpace = models['WorkSpace']
const CoLivingSpace = models['CoLivingSpace']
const OfficeSpace = models['OfficeSpace']
const WhatsAppMessage = models['WhatsAppMessage'];
const WhatsappReadState = models['WhatsappReadState'];
const firstVirtualSid = 'HX5682fe790b243bef23eaca8db24353dd';
const secondVirtualSid = 'HXfd72bcab990296d4587aece331ae5640';
const thirdVirtualSid = 'HX6a9e9d47d330cbe910abe01531e062e6';
const fourthVirtualSid = 'HX48e205752a172ba8bc3159ecab26064a'; // TODO: Replace with actual fourth reminder WhatsApp SID



class ManageEnquiryService {
    constructor() {
        return {
            getEnquiryById: this.getEnquiryById.bind(this),
            getVendorenquiries: this.getVendorenquiries.bind(this),
            getEnquiries: this.getEnquiries.bind(this),
            changeStatus: this.changeStatus.bind(this),
            deleteLead: this.deleteLead.bind(this),
            exportLeads: this.exportLeads.bind(this),
            updateLeads: this.updateLeads.bind(this),
            addNoteToLead: this.addNoteToLead.bind(this),
            updateNoteInLead: this.updateNoteInLead.bind(this),
            deleteNoteInLead: this.deleteNoteInLead.bind(this),
            createManualLead: this.createManualLead.bind(this),
            updateManualLead: this.updateManualLead.bind(this),
            deleteManyLead: this.deleteManyLead.bind(this),
            leadsAccess: this.leadsAccess.bind(this),
            removeLeadsAccess: this.removeLeadsAccess.bind(this),
            sendLeadReminders: this.sendLeadReminders.bind(this),
            sendVirtualReminders: this.sendVirtualReminders.bind(this),
            getEnquiryCount: this.getEnquiryCount.bind(this)
        }
    }
    adjustLeadAddedTime(date) {
        let adjustedDate = new Date(date);
        let hours = adjustedDate.getHours();
        let day = adjustedDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        if (day === 0) {
            // If Sunday, move to Monday at 10 AM
            adjustedDate.setDate(adjustedDate.getDate() + 1);
            adjustedDate.setHours(10, 0, 0, 0);
        } else if (hours < 10 || hours >= 19) {
            // If added between 7 PM - 10 AM, set time to 10 AM of the same day
            adjustedDate.setHours(10, 0, 0, 0);
        }
        return adjustedDate;
    }
    _createTemplateObjects(email, htmlVariables, template, lead = null) {
        let htmlVars = { name: htmlVariables };
        let subjectVariables = {};
        if ((template === 'virtual_first_reminder' || template === 'virtual_second_reminder' || template === 'virtual_third_reminder' || template === 'virtual_fourth_reminder') && lead) {
            const firstName = (lead.other_info?.name || '').split(' ')[0] || '';
            const formattedName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : '';
            const cityStr = (lead.city || '').toString().trim();
            const city = cityStr ? cityStr.charAt(0).toUpperCase() + cityStr.slice(1).toLowerCase() : '';
            htmlVars = { name: formattedName, city };
            subjectVariables = { city };
        }
        return {
            userParams: {
                toEmails: [email],
                templateName: template,
                htmlVariables: htmlVars,
                subjectVariables,
                bccAddresses: [],
                ccAddresses: []
            }
        }
    }
   
    async sendVirtualReminders(type) {
        const leads = [];

        if (type === 'first') {
            // First reminder: leads added exactly 2 days ago
            const targetDate = this._getXDaysAgo(2);
            leads.push(
                ...(await Enquiry.find({
                    added_on: {
                        $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
                        $lte: new Date(targetDate.setHours(23, 59, 59, 999))
                    },
                    lead_stage: { $nin: ["Agreement Stage"] },
                    space_type: "Web Virtual Office",
                    isOtp: true,
                    last_reminder_sent: 0
                }))
            );
        } else if (type === 'second_and_third') {
            // Second reminder: leads added exactly 4 days ago
            const secondReminderDate = this._getXDaysAgo(4);
            leads.push(
                ...(await Enquiry.find({
                    added_on: {
                        $gte: new Date(secondReminderDate.setHours(0, 0, 0, 0)),
                        $lte: new Date(secondReminderDate.setHours(23, 59, 59, 999))
                    },
                    lead_stage: { $nin: ["Agreement Stage"] },
                    space_type: "Web Virtual Office",
                    isOtp: true,
                    last_reminder_sent: 1
                }))
            );

            // Third reminder: leads added exactly 7 days ago
            const thirdReminderDate = this._getXDaysAgo(7);
            leads.push(
                ...(await Enquiry.find({
                    added_on: {
                        $gte: new Date(thirdReminderDate.setHours(0, 0, 0, 0)),
                        $lte: new Date(thirdReminderDate.setHours(23, 59, 59, 999))
                    },
                    lead_stage: { $nin: ["Agreement Stage"] },
                    space_type: "Web Virtual Office",
                    isOtp: true,
                    last_reminder_sent: 2
                }))
            );

            // Fourth reminder: leads added exactly 11 days ago
            const fourthReminderDate = this._getXDaysAgo(11);
            leads.push(
                ...(await Enquiry.find({
                    added_on: {
                        $gte: new Date(fourthReminderDate.setHours(0, 0, 0, 0)),
                        $lte: new Date(fourthReminderDate.setHours(23, 59, 59, 999))
                    },
                    lead_stage: { $nin: ["Agreement Stage"] },
                    space_type: "Web Virtual Office",
                    isOtp: true,
                    last_reminder_sent: 3
                }))
            );
        }

        for (const lead of leads) {
            const index = lead.last_reminder_sent || 0;
            let templateKey = '';
            let sid = '';

            if (index === 0) {
                templateKey = 'virtual_first_reminder';
                sid = firstVirtualSid;
            } else if (index === 1) {
                templateKey = 'virtual_second_reminder';
                sid = secondVirtualSid;
            } else if (index === 2) {
                templateKey = 'virtual_third_reminder';
                sid = thirdVirtualSid;
            } else if (index === 3) {
                templateKey = 'virtual_fourth_reminder';
                sid = fourthVirtualSid;
            }

            const getTemplateObject = this._createTemplateObjects(lead.other_info.email, lead.other_info.name, templateKey, lead);
            await messageService.sendWhatsAppMessageForVirtual(lead.other_info.phone_number, [lead.other_info.name, lead.city], sid);
            await aws.sendMail(getTemplateObject.userParams);

            lead.last_reminder_sent += 1;
            await lead.save();
        }
    }

    // Helper to get date X calendar days ago
    _getXDaysAgo(daysAgo) {
        const result = new Date();
        result.setDate(result.getDate() - daysAgo);
        return result;
    }

    // Helper to get date X working days ago (skips Sundays)
    _getXWorkingDaysAgo(daysAgo) {
        const result = new Date();
        while (daysAgo > 0) {
            result.setDate(result.getDate() - 1);
            if (result.getDay() !== 0) { // 0 = Sunday
                daysAgo--;
            }
        }
        return result;
    }


    async sendLeadReminders() {
        const REMINDER_INTERVALS = [30, 50, 60, 70];
        const seats = ['11-20', '20-50', '50-100', '50+', '100+']
        const now = new Date();
        const oneDayAgo = new Date(now);
        oneDayAgo.setHours(now.getHours() - 24); // 24 hours ago

        const leads = await Enquiry.find({
            lead_stage: "New",
            space_type: "Web Coworking",
            no_of_seats: { $in: seats },
            isOtp: true,
            added_on: { $gte: oneDayAgo, $lte: now }, // Get leads from the last 24 hours
            last_reminder_sent: { $lt: 4 }, // Ensure only 3 reminders are sent
        });
        for (const lead of leads) {
            const assignedTime = moment(this.adjustLeadAddedTime(lead.added_on));
            const minutesSinceAssigned = moment(now).diff(assignedTime, "minutes");
            let nextReminderIndex = lead.last_reminder_sent || 0;
            if (lead.assignedUsers.length > 0) {
                const users = await User.find({ _id: { $in: lead.assignedUsers } })
                const filterdUser = users.filter((user) => user?.isLeadReminder)
                if (nextReminderIndex < REMINDER_INTERVALS.length - 1 && (filterdUser.length === 1 && filterdUser[0].sales_contact)) {
                    const nextReminderTime = REMINDER_INTERVALS[nextReminderIndex];
                    if (minutesSinceAssigned >= nextReminderTime) {
                        await messageService.sendReminder(`+91${filterdUser[0]?.sales_contact}`, [String(nextReminderIndex + 1), lead.other_info.name, lead.other_info.phone_number, lead.other_info.email, lead.no_of_seats, lead.interested_in, lead.city, lead.microlocation, lead.page_url]);
                        lead.last_reminder_sent += 1;
                        await lead.save();
                    }
                }
                if (nextReminderIndex === 3 && (filterdUser.length === 1 && filterdUser[0].sales_contact)) {
                    const nextReminderTime = REMINDER_INTERVALS[nextReminderIndex];
                    if (minutesSinceAssigned >= nextReminderTime) {
                        await messageService.sendReminderToCEO(`+919599993993`, [lead.other_info.name, lead.other_info.phone_number, lead.other_info.email, lead.no_of_seats, lead.interested_in, lead.city, lead.microlocation, lead.page_url]);
                        lead.last_reminder_sent += 1;
                        await lead.save();
                    }
                }
            }
        }
    }

    async exportLeads({ limit, skip, orderBy = -1, sortBy = 'added_on', interested_in, name, email, phone_number, space_type, city, location, address, leadId, noOfSeats, budget, pageUrl, status, startDate, endDate, budgets, includeFields, user }) {
        try {
            const result = {};
            let condition = {};
            let flags = JSON.parse(includeFields)
            if (interested_in) {
                condition['interested_in'] = new RegExp(`^${interested_in.replace(/[-\s]/g, '[\\s-]')}$`, 'i');
            }
            if (name) {
                name = name.replace(/[^A-Za-z0-9 ]/g, "");
                condition['other_info.name'] = { '$regex': `^(\s+${name}|^${name})`, '$options': 'i' };
            }
            if (leadId) {
                leadId = leadId.replace(/[^A-Za-z0-9 ]/g, "");
                condition['lead_id'] = { '$regex': `^(\s+${leadId}|^${leadId})`, '$options': 'i' };
            }
            if (email) {
                email = email.replace(/[^A-Za-z0-9 ]/g, "");
                condition['other_info.email'] = { '$regex': `^(\s+${email}|^${email})`, '$options': 'i' };
            }
            if (phone_number) {
                phone_number = '.*' + phone_number + '.*';
                condition['other_info.phone_number'] = { $regex: new RegExp('^' + phone_number + '$', 'i') };
            }
            if (space_type) {
                condition['space_type'] = { $regex: `^${space_type}$`, $options: "i" };
            }
            if (budget) {
                const budgetsArray = Array.isArray(budget) ? budget : [budget];
                const colivingRegexPatterns = budgetsArray.map(type => {
                    const escapedType = type.replace(/[-\s]/g, '[\\s-]');
                    return new RegExp(`^${escapedType}$`, 'i');
                });
                condition['budget'] = { $in: colivingRegexPatterns };
            }
            if (status) {
                condition['status'] = status
            }
            if (noOfSeats) {
                const seats = JSON.parse(decodeURIComponent(noOfSeats));
                const noOfSeatsRegexPatterns = seats.map(seat => {
                    const escapedSeat = seat.replace(/[+]/g, '\\+');  // Escape the '+' character
                    return new RegExp(`^${escapedSeat}$`, 'i');
                });
                condition['no_of_seats'] = { $in: noOfSeatsRegexPatterns };
            }
            if (budgets && budgets.length > 0) {
                condition['budget'] = { $in: budgets };
            }
            if (location) {
                location = location.replace(/[^A-Za-z0-9 ]/g, "");
                condition['microlocation'] = { '$regex': `^(\s+${location}|^${location})`, '$options': 'i' };
            }
            if (address) {
                address = address.replace(/[^A-Za-z0-9 ]/g, "");
                condition['address'] = { '$regex': `^(\s+${address}|^${address})`, '$options': 'i' };
            }
            if (pageUrl) {
                pageUrl = pageUrl.replace(/[^A-Za-z0-9 ]/g, "");
                condition['page_url'] = { '$regex': `^(\s+${pageUrl}|^${pageUrl})`, '$options': 'i' };
            }
            if (user) {
                const access = JSON.parse(user);
                const leadSource = access.lead_source;
                let userConditions = [];
                const userDate = access.added_on;
                if (access) {
                    condition['assignedUsers'] = { $in: [new ObjectId(access._id)] };
                }
                if (leadSource && leadSource?.length > 0) {
                    condition["leadSource"] = { "$in": leadSource };
                }
            }
            const startDateString = new Date(startDate);
            const endDateString = new Date(endDate);
            if (startDate && endDate) {
                condition['added_on'] = {
                    $gte: startDateString,
                    $lte: endDateString
                };
            }
            if (city) {
                city = city.replace(/[^A-Za-z0-9 ]/g, "");
                condition.$and = condition.$and || [];
                condition.$and.push({ city: { '$regex': `^(\s+${city}|^${city})`, '$options': 'i' } });
            }
            result.enquiries = await Enquiry.find(condition)
                .populate('user')
                .populate('assignedUsers')
                // .populate('work_space')
                // .populate('office_space')
                .sort({
                    [sortBy]: -1
                });
            const fields = [];
            const mappedEnquiries = result.enquiries.map(enquiry => {
                const obj = enquiry.toObject();
                if (obj.other_info && obj.other_info.phone_number) {
                    obj.other_info.phone_number = obj.other_info.phone_number.replace(/^\+91-/, '');
                }
                if(obj.assignedUsers.length > 0){
                    obj.assignedUsers = obj.assignedUsers.map((user) => user.name).join(",");
                }
                if(obj.notes.length > 0){
                    obj.notes = obj.notes.map((note) => note.note).join(",");
                }
                const mappedData = {};
                if (flags.includeName) {
                    fields.push("Name");
                    mappedData["Name"] = obj?.other_info?.name;
                }
                if (flags.includeEmail) {
                    fields.push("Email");
                    mappedData["Email"] = obj?.other_info?.email;
                }
                if (flags.includePhoneNumber) {
                    fields.push("Phone Number");
                    mappedData["Phone Number"] = obj?.other_info?.phone_number;
                }
                if (flags.includeUser) {
                    fields.push("Assigned User");
                    mappedData["Assigned User"] = obj?.assignedUsers;
                }
                if (flags.includeNotes) {
                    fields.push("Notes");
                    mappedData["Notes"] = obj?.notes;
                }
                if (flags.includeInterestedIn) {
                    fields.push("Interested In");
                    mappedData["Interested In"] = obj?.interested_in;
                }
                if (flags.includeSpaceType) {
                    fields.push("Space Type");
                    mappedData["Space Type"] = obj?.space_type;
                }
                if (flags.includeCity) {
                    fields.push("City");
                    mappedData["City"] = obj?.city;
                }
                if (flags.includeLocation) {
                    fields.push("Location");
                    mappedData["Location"] = obj?.microlocation;
                }
                if (flags.includeAddress) {
                    fields.push("Address");
                    mappedData["Address"] = obj?.address;
                }
                if (flags.includeLeadId) {
                    fields.push("Lead ID");
                    mappedData["Lead ID"] = obj?.lead_id;
                }
                if (flags.includeNoOfSeats) {
                    fields.push("Number of Seats");
                    mappedData["Number of Seats"] = obj?.no_of_seats;
                }
                if (flags.includeBudget) {
                    fields.push("Budget");
                    mappedData["Budget"] = obj?.budget;
                }
                if (flags.includePageUrl) {
                    fields.push("Page URL");
                    mappedData["Page URL"] = obj?.page_url;
                }
                if (flags.includeStatus) {
                    fields.push("Status");
                    mappedData["Status"] = obj?.status;
                }
                if (flags.includeAddedOn) {
                    const addedOnDate = new Date(obj.added_on);
                    const formattedDate = addedOnDate.toLocaleDateString();
                    fields.push("Date");
                    mappedData["Date"] = formattedDate;
                }
                if (flags.includeTime) {
                    const addedOnDate = new Date(obj.added_on);
                    const formattedTime = addedOnDate.toLocaleTimeString();
                    fields.push("Time");
                    mappedData["Time"] = formattedTime;
                }
                return mappedData;
            });
            const uniqueFields = [...new Set(fields)];
            const json2csvParser = new Json2CsvParser({ fields: uniqueFields });
            const csv = json2csvParser.parse(mappedEnquiries);
            result.count = await Enquiry.countDocuments(condition);
            return csv;
        } catch (error) {
            throw (error);
        }
    }
    async deleteManyLead({ leads }) {
        try {
            if (!leads) return
            await Enquiry.deleteMany({ _id: { $in: leads } });
            return true;
        } catch (error) {
            throw error;
        }
    }
    pad(n) {
        var s = "000" + n;
        return s.substr(s.length - 4);
    }
    async createManualLead({ interested_in, name, email, phone_number, space_type, city, microlocation, address, no_of_seats, budget, note, leadSource, companyName, tenure }) {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const day = now.getDate();
            let totalCount = await Enquiry.countDocuments();
            let finalCount = totalCount + 1;
            let lead_id = `CFL${day}${month}${year}${this.pad(finalCount)}`
            const lead = await Enquiry.create({
                city,
                microlocation,
                space_type,
                budget,
                no_of_seats,
                address,
                interested_in,
                note,
                lead_id,
                leadSource,
                companyName,
                tenure,
                other_info: {
                    email,
                    name,
                    phone_number,
                }
            })
            return lead;
        } catch (e) {
            throw e;
        }
    }
    async updateManualLead({ id, interested_in, name, email, phone_number, space_type, city, microlocation, address, no_of_seats, budget, note, leadSource, companyName, tenure }) {
        try {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const day = now.getDate();
            let totalCount = await Enquiry.countDocuments();
            let finalCount = totalCount + 1;
            let lead_id = `CFL${day}${month}${year}${this.pad(finalCount)}`
            const lead = await Enquiry.findOneAndUpdate({ _id: id }, {
                city,
                microlocation,
                space_type,
                budget,
                no_of_seats,
                address,
                interested_in,
                note,
                leadSource,
                companyName,
                tenure,
                other_info: {
                    email,
                    name,
                    phone_number,
                }
            })
            return lead;
        } catch (e) {
            throw e;
        }
    }

    async updateLeads({ id, rm, comment, date_called, lead_stage }) {
        try {
            const leads = await Enquiry.findOneAndUpdate({ _id: id }, {
                rm, comment, date_called, lead_stage
            });
            return leads
        } catch (e) {
            throw (e)
        }
    }

    async addNoteToLead({ id, noteContent, user }) {
        try {
            const lead = await Enquiry.findOneAndUpdate(
                { _id: new ObjectId(id) },
                { $push: { notes: { note: noteContent, user } } },
                { new: true }
            ).populate({
                path: "notes.user",
                select: "name _id" // Only fetch name and _id
            });
            return lead;
        } catch (e) {
            throw e;
        }
    }
    async updateNoteInLead({ leadId, noteId, updatedContent, user }) {
        try {
            const lead = await Enquiry.findOneAndUpdate(
                { _id: leadId, "notes._id": noteId },
                {
                    $set: {
                        "notes.$.note": updatedContent,
                        "notes.$.user": user,
                        "notes.$.updated_on": new Date()  // Update the timestamp
                    }
                },
                { new: true }
            ).populate({
                path: "notes.user",
                select: "name _id" // Only fetch name and _id
            });
            return lead;
        } catch (e) {
            throw e;
        }
    }
    async deleteNoteInLead({ leadId, noteId }) {
        try {
            const leadObjectId = new ObjectId(leadId);
            const noteObjectId = new ObjectId(noteId);
            const updatedLead = await Enquiry.findOneAndUpdate(
                { _id: leadObjectId },
                { $pull: { notes: { _id: noteObjectId } } },
                { new: true }
            ).populate({
                path: "notes.user",
                select: "name _id" // Only fetch name and _id
            });
            return updatedLead;
        } catch (e) {
            throw e;
        }
    }

    async getEnquiryById({ id }) {
        try {
            const enquiry = await Enquiry.findOne({ _id: id }).populate({
                path: "notes.user",
                select: "name _id" // Only fetch name and _id
            });;
            return enquiry;
        } catch (error) {
            throw (error);
        }
    }
    async deleteLead({ id }) {
        try {
            await Enquiry.deleteOne({ _id: id });
            return true;
        } catch (error) {
            throw (error);
        }
    }
    async leadsAccess({ leads, users }) {
        try {
            if (!leads || !users || leads.length === 0 || users.length === 0) return false;

            await Enquiry.updateMany(
                { _id: { $in: leads.map(id => new ObjectId(id)) } },
                { $addToSet: { assignedUsers: { $each: users } } } // Ensures unique users
            );

            return true;
        } catch (error) {
            throw error;
        }
    }
    async removeLeadsAccess({ leads, users }) {
        try {
            if (!leads || !users || leads.length === 0 || users.length === 0) return false;

            await Enquiry.updateMany(
                { _id: { $in: leads.map(id => new ObjectId(id)) } },
                { $pull: { assignedUsers: { $in: users } } } // Removes users from assignedUsers
            );

            return true;
        } catch (error) {
            throw error;
        }
    }



    async getEnquiries({
        limit,
        skip,
        orderBy = -1,
        sortBy = 'added_on',
        interested_in,
        name,
        email,
        phone_number,
        space_type,
        city,
        location,
        address,
        leadId,
        noOfSeats,
        budget,
        pageUrl,
        lead_stage,
        status,
        startDate,
        endDate,
        budgets,
        user,
        living_space,
        site_visit,
        marketingUser,
        has_whatsapp_session,
        has_whatsapp_latest,
        has_whatsapp_unread
    }) {
        try {
            const result = {};
            let condition = {};

            // Build the filter conditions
            if (interested_in) {
                condition['interested_in'] = new RegExp(`^${interested_in.replace(/[-\s]/g, '[\\s-]')}$`, 'i');
            }
            if (name) {
                name = name.replace(/[^A-Za-z0-9 ]/g, "");
                condition['other_info.name'] = { '$regex': `^(\s+${name}|^${name})`, '$options': 'i' };
            }
            if (leadId) {
                leadId = leadId.replace(/[^A-Za-z0-9 ]/g, "");
                condition['lead_id'] = { '$regex': `^(\s+${leadId}|^${leadId})`, '$options': 'i' };
            }
            if (living_space) {
                condition['living_space'] = new ObjectId(living_space);
            }
            if (email) {
                email = email.replace(/[^A-Za-z0-9@.]/g, "");
                condition['other_info.email'] = { '$regex': `^${email}`, '$options': 'i' };
            }
            if (phone_number) {
                phone_number = '.*' + phone_number + '.*';
                condition['other_info.phone_number'] = { $regex: new RegExp('^' + phone_number + '$', 'i') };
            }
            if (space_type) {
                condition['space_type'] = { $regex: `^${space_type}$`, $options: "i" };
            }
            if (site_visit) {
                condition['booking_date'] = { $exists: true, $ne: null };
            }
            if (budget) {
                const budgetsArray = Array.isArray(budget) ? budget : [budget];
                const colivingRegexPatterns = budgetsArray.map(type => {
                    const escapedType = type.replace(/[-\s]/g, '[\\s-]');
                    return new RegExp(`^${escapedType}$`, 'i');
                });
                condition['budget'] = { $in: colivingRegexPatterns };
            }
            if (has_whatsapp_session == 1) {
                condition['whatsappSessionExpiry'] = { $exists: true, $ne: null };
              }
            if (status) {
                condition['status'] = status;
            }
            if (lead_stage) {
                condition['lead_stage'] = new RegExp(`^${lead_stage.replace(/[-\s]/g, '[\\s-]')}$`, 'i');
            }
            if (noOfSeats) {
                const seats = JSON.parse(decodeURIComponent(noOfSeats));
                const noOfSeatsRegexPatterns = seats.map(seat => {
                    const escapedSeat = seat.replace(/[+]/g, '\\+');  // Escape the '+' character
                    return new RegExp(`^${escapedSeat}$`, 'i');
                });
                condition['no_of_seats'] = { $in: noOfSeatsRegexPatterns };
            }
            if (budgets && budgets.length > 0) {
                condition['budget'] = { $in: budgets };
            }
            if (location) {
                location = location.replace(/[^A-Za-z0-9 ]/g, "");
                condition['microlocation'] = { '$regex': `^(\s+${location}|^${location})`, '$options': 'i' };
            }
            if (address) {
                address = address.replace(/[^A-Za-z0-9 ]/g, "");
                condition['address'] = { '$regex': `^(\s+${address}|^${address})`, '$options': 'i' };
            }
            if (pageUrl) {
                pageUrl = pageUrl.replace(/[^A-Za-z0-9 ]/g, "");
                condition['page_url'] = { '$regex': `^(\s+${pageUrl}|^${pageUrl})`, '$options': 'i' };
            }
            if (startDate && endDate) {
                const startDateString = new Date(startDate);
                const endDateString = new Date(endDate);
                condition['added_on'] = {
                    $gte: startDateString,
                    $lte: endDateString
                };
            }
            if (city) {
                city = city.replace(/[^A-Za-z0-9 ]/g, "");
                condition.$and = condition.$and || [];
                condition.$and.push({ city: { '$regex': `^(\s+${city}|^${city})`, '$options': 'i' } });
            }
            if (user) {
                const access = JSON.parse(user);
                const leadSource = access.lead_source;
                let userConditions = [];
                const userDate = access.added_on;
                if (access) {
                    condition['assignedUsers'] = { $in: [new ObjectId(access._id)] };
                }
                if (leadSource && leadSource?.length > 0) {
                    condition["leadSource"] = { "$in": leadSource };
                }
            }
            if (marketingUser) {
                const access = JSON.parse(marketingUser);
                const leads = access.enquiry;
                const userDate = access.added_on;
                const leadSource = access.lead_source;
                if (leads && leads.length > 0) {
                    const query = {
                        "$or": leads.map(criteria => {
                            const andConditions = [
                                { "space_type": { "$in": [criteria.space] } }
                            ];
                            if (criteria.cities && criteria.cities.length > 0) {
                                andConditions.push({
                                    "$or": criteria.cities.map(city => {
                                        let cityConditions = {};
                                        if (city.city) {
                                            cityConditions.city = new RegExp(`^${city.city}$`, 'i');
                                        }
                                        if (city.seats.length > 0) {
                                            cityConditions.no_of_seats = { "$in": city.seats };
                                        }
                                        if (criteria.space === 'Web Coworking') {
                                            if (city.workSpaceType.length > 0) {
                                                const workspaceRegexPatterns = city.workSpaceType.map(type => new RegExp(`^${type.replace(/[-\s]/g, '[\\s-]')}$`, 'i'));
                                                cityConditions.interested_in = { "$in": workspaceRegexPatterns };
                                            }
                                        }
                                        if (criteria.space === 'Web Coliving') {
                                            if (city.colivingType.length > 0) {
                                                const colivingRegexPatterns = city.colivingType.map(type => new RegExp(`^${type.replace(/[-\s]/g, '[\\s-]')}$`, 'i'));
                                                cityConditions.interested_in = { "$in": colivingRegexPatterns };
                                            }
                                        }
                                        if (city.budget.length > 0) {
                                            const colivingRegexPatterns = city.budget.map(type => new RegExp(`^${type.replace(/[-\s]/g, '[\\s-]')}$`, 'i'));
                                            cityConditions.budget = { "$in": colivingRegexPatterns };
                                        }
                                        if (criteria.space !== 'Web Coliving') {
                                            if (city.locations.length > 0) {
                                                const locationRegexPatterns = city.locations.map(type => new RegExp(`^${type.replace(/[-\s]/g, '[\\s-]')}$`, 'i'));
                                                cityConditions.microlocation = { "$in": locationRegexPatterns };
                                            }
                                        }
                                        if (criteria.space === 'Web Coliving') {
                                            if (city.locations.length > 0) {
                                                cityConditions.location = { "$in": city.locations };
                                            }
                                        }
                                        return cityConditions;
                                    })
                                });
                            }
                            // if (userDate) {
                            //     andConditions.push({ "added_on": { "$gte": new Date(userDate) } });
                            // }
                            if (leadSource && leadSource?.length > 0) {
                                andConditions.push({ "leadSource": { "$in": leadSource } });
                            }
                            return { "$and": andConditions };
                        })
                    };
                    condition = { ...condition, ...query };
                }
            }
            // Apply WhatsApp filters at DB level so pagination is over whole filtered set
            await this._applyWhatsAppFiltersToCondition(condition, has_whatsapp_latest, has_whatsapp_unread);

            const mainPipeline = [
                { $match: condition }, // Apply the filter conditions
                {
                    $lookup: {
                        from: 'users',  // Ensure this matches the actual collection name in MongoDB
                        localField: 'assignedUsers',  // This references the array of ObjectIds
                        foreignField: '_id',  // Matches with the _id field in users collection
                        as: 'assignedUsers'  // Overwrite assignedUsers with populated user data
                    }
                },
                {
                    $addFields: {
                        assignedUsers: {
                            $map: {
                                input: "$assignedUsers",
                                as: "user",
                                in: { _id: "$$user._id", name: "$$user.name", is_active: "$$user.is_active" } // Only include _id and name
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: 'users', // Lookup in users collection
                        localField: 'notes.user', // notes array contains user ObjectIds
                        foreignField: '_id',
                        as: 'notesUsers' // Temporarily store populated users
                    }
                },
                {
                    $addFields: {
                        notes: {
                            $map: {
                                input: "$notes",
                                as: "note",
                                in: {
                                    _id: "$$note._id",
                                    note: "$$note.note",
                                    user: {
                                        $let: {
                                            vars: {
                                                matchedUser: {
                                                    $arrayElemAt: [
                                                        {
                                                            $filter: {
                                                                input: "$notesUsers",
                                                                as: "user",
                                                                cond: { $eq: ["$$user._id", "$$note.user"] }
                                                            }
                                                        },
                                                        0 // Get the first matching user
                                                    ]
                                                }
                                            },
                                            in: {
                                                _id: "$$matchedUser._id",
                                                name: "$$matchedUser.name",
                                                is_active: "$$matchedUser.is_active"
                                            }
                                        }
                                    },
                                    added_on: "$$note.added_on",
                                    updated_on: "$$note.updated_on"
                                }
                            }
                        }
                    }
                },
                { $unset: "notesUsers" },
                { $sort: { added_on: -1 } }, // Sort all leads by added_on in descending order
                {
                    $group: {
                        _id: "$other_info.phone_number", // Group by phone number
                        latestLead: { $first: "$$ROOT" }, // Get the latest lead in each group
                        allLeads: { $push: "$$ROOT" } // Store all leads in the group
                    }
                },
                {
                    $replaceRoot: {
                        newRoot: {
                            latestLead: "$latestLead",
                            allLeads: "$allLeads"
                        }
                    }
                },
                { $sort: { "latestLead.added_on": -1 } }, // Sort groups by the latest lead's added_on timestamp
                { $skip: skip }, // Skip documents for pagination
                { $limit: limit } // Limit the number of documents per page
            ]
            const countPipeline = [
                { $match: condition }, // Apply the filter conditions
                {
                    $group: {
                        _id: "$other_info.phone_number" // Group by phone number
                    }
                },
                {
                    $count: "total" // Count the total number of groups
                }
            ]
            let totalGroups;
            [result.enquiries, totalGroups] = await Promise.all([
                Enquiry.aggregate(mainPipeline).allowDiskUse(true).exec(),
                Enquiry.aggregate(countPipeline).allowDiskUse(true).exec()
            ]);

            // Enrich current page with WhatsApp latest message + unread flags
            result.enquiries = await this._attachWhatsAppMetaToEnquiries(
                result.enquiries,
                { has_whatsapp_latest, has_whatsapp_unread }
            );

            // Keep total count based on full aggregation (for pagination),
            // not just the current page length.
            result.count = totalGroups.length > 0 ? totalGroups[0].total : 0;
            return result;
        } catch (error) {
            throw error;
        }
    }
    /**
     * Normalize phone in the same way as WhatsApp service.
     */
    _normalizePhoneForWhatsApp(value) {
        if (!value || typeof value !== 'string') return '';
        let phone = value.replace(/^whatsapp:/i, '').trim();
        phone = phone.replace(/[\s\-()]/g, '');
        return phone;
    }

    /**
     * Build possible phone formats as stored in Enquiry.other_info.phone_number.
     * Used to match Enquiry docs when filtering by WhatsApp (has_whatsapp_latest / has_whatsapp_unread).
     */
    _getPhoneVariantsForEnquiry(normalizedPhone) {
        if (!normalizedPhone) return [];
        const set = new Set([normalizedPhone]);
        if (normalizedPhone.startsWith('+')) {
            set.add(normalizedPhone.slice(1));
        } else {
            set.add('+' + normalizedPhone);
        }
        const digitsOnly = normalizedPhone.replace(/\D/g, '');
        if (digitsOnly.length >= 10) {
            set.add(digitsOnly.slice(-10));
            set.add('+91' + digitsOnly.slice(-10));
            set.add('+91-' + digitsOnly.slice(-10));
        }
        set.add(digitsOnly);
        return [...set].filter(Boolean);
    }

    /**
     * Resolve phones that have WhatsApp latest message and/or unread, then add
     * other_info.phone_number $in variant list to condition so filtering is over whole data.
     */
    async _applyWhatsAppFiltersToCondition(condition, has_whatsapp_latest, has_whatsapp_unread) {
        if (has_whatsapp_latest !== '1' && has_whatsapp_unread !== '1') {
            return;
        }
        let phonesWithLatest = null;
        let phonesWithUnread = null;

        if (has_whatsapp_latest === '1') {
            const distinct = await WhatsAppMessage.distinct('phone');
            phonesWithLatest = new Set(distinct.filter(Boolean));
        }
        if (has_whatsapp_unread === '1') {
            const [readStates, inboundByPhone] = await Promise.all([
                WhatsappReadState.find({}).lean(),
                WhatsAppMessage.aggregate([
                    { $match: { direction: 'inbound' } },
                    { $group: { _id: '$phone', maxCreatedAt: { $max: '$createdAt' } } }
                ])
            ]);
            const lastSeenByPhone = {};
            readStates.forEach(rs => {
                lastSeenByPhone[rs.phone] = rs.lastSeenAt ? new Date(rs.lastSeenAt).getTime() : 0;
            });
            phonesWithUnread = new Set();
            inboundByPhone.forEach(({ _id: phone, maxCreatedAt }) => {
                if (!phone) return;
                const lastSeen = lastSeenByPhone[phone] ?? 0;
                if (new Date(maxCreatedAt).getTime() > lastSeen) {
                    phonesWithUnread.add(phone);
                }
            });
        }

        let targetPhones = null;
        if (phonesWithLatest !== null && phonesWithUnread !== null) {
            targetPhones = [...phonesWithLatest].filter(p => phonesWithUnread.has(p));
        } else if (phonesWithLatest !== null) {
            targetPhones = [...phonesWithLatest];
        } else {
            targetPhones = [...phonesWithUnread];
        }

        const variantSet = new Set();
        targetPhones.forEach(phone => {
            this._getPhoneVariantsForEnquiry(phone).forEach(v => variantSet.add(v));
        });
        if (variantSet.size === 0) {
            condition['other_info.phone_number'] = { $in: [null] };
            return;
        }
        condition['other_info.phone_number'] = { $in: [...variantSet] };
    }

    /**
     * Attach WhatsApp latest message / unread to grouped enquiries.
     * Applies has_whatsapp_latest / has_whatsapp_unread filters in-memory.
     */
    async _attachWhatsAppMetaToEnquiries(enquiries, { has_whatsapp_latest, has_whatsapp_unread }) {
        if (!enquiries || enquiries.length === 0) return [];

        // 1) Collect unique normalized phones from latestLead.other_info.phone_number
        const phoneSet = new Set();
        const phoneByGroupIndex = [];

        enquiries.forEach((group, idx) => {
            const raw = group?.latestLead?.other_info?.phone_number;
            const normalized = this._normalizePhoneForWhatsApp(raw);
            phoneByGroupIndex[idx] = normalized || null;
            if (normalized) {
                phoneSet.add(normalized);
            }
        });

        const phones = Array.from(phoneSet);
        if (phones.length === 0) {
            // No phones; optionally still apply filters
            if (has_whatsapp_latest === '1' || has_whatsapp_unread === '1') {
                return [];
            }
            return enquiries;
        }

        // 2) Fetch latest message per phone
        const latestAgg = await WhatsAppMessage.aggregate([
            { $match: { phone: { $in: phones } } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$phone',
                    latestMessage: { $first: '$$ROOT' }
                }
            }
        ]);
        const latestByPhone = {};
        latestAgg.forEach(row => {
            latestByPhone[row._id] = row.latestMessage;
        });

        // 3) Fetch read state
        const readStates = await WhatsappReadState.find({ phone: { $in: phones } }).lean();
        const lastSeenByPhone = {};
        readStates.forEach(rs => {
            lastSeenByPhone[rs.phone] = rs.lastSeenAt || new Date(0);
        });

        // 4) Determine unread per phone (inbound after lastSeenAt)
        const unreadByPhone = {};
        await Promise.all(phones.map(async (phone) => {
            const lastSeenAt = lastSeenByPhone[phone] || new Date(0);
            const exists = await WhatsAppMessage.exists({
                phone,
                direction: 'inbound',
                createdAt: { $gt: lastSeenAt }
            });
            unreadByPhone[phone] = !!exists;
        }));

        // 5) Attach to each group (latestLead and allLeads)
        const filtered = enquiries.filter((group, idx) => {
            const phone = phoneByGroupIndex[idx];
            if (!phone) {
                // No phone: treat as no WhatsApp meta
                group.latestLead.whatsappLatestMessage = null;
                group.latestLead.whatsappLatestAt = null;
                group.latestLead.whatsappUnread = false;
                group.allLeads = (group.allLeads || []).map(ld => ({
                    ...ld,
                    whatsappLatestMessage: null,
                    whatsappLatestAt: null,
                    whatsappUnread: false
                }));
            } else {
                const latest = latestByPhone[phone];
                const unread = !!unreadByPhone[phone];
                const latestMessage = latest?.message || null;
                const latestAt = latest?.createdAt || null;

                group.latestLead.whatsappLatestMessage = latestMessage;
                group.latestLead.whatsappLatestAt = latestAt;
                group.latestLead.whatsappUnread = unread;

                group.allLeads = (group.allLeads || []).map(ld => ({
                    ...ld,
                    whatsappLatestMessage: latestMessage,
                    whatsappLatestAt: latestAt,
                    whatsappUnread: unread
                }));
            }

            // DB already filtered by has_whatsapp_latest / has_whatsapp_unread; no in-memory filter needed
            return true;
        });

        // 6) When requested, sort groups so leads with latest WhatsApp activity come first.
        // Otherwise, keep the default aggregation sort by latestLead.added_on.
        if (has_whatsapp_latest === '1') {
            filtered.sort((a, b) => {
                const aTime = a.latestLead?.whatsappLatestAt
                    ? new Date(a.latestLead.whatsappLatestAt).getTime()
                    : 0;
                const bTime = b.latestLead?.whatsappLatestAt
                    ? new Date(b.latestLead.whatsappLatestAt).getTime()
                    : 0;
                if (aTime === 0 && bTime === 0) {
                    // No WhatsApp activity on either; keep original order
                    return 0;
                }
                return bTime - aTime;
            });
        }

        return filtered;
    }
    async getEnquiryCount({ noOfSeats, startDate, endDate }) {
        try {
            let condition = {};

            if (noOfSeats) {
                const seats = JSON.parse(decodeURIComponent(noOfSeats));
                const seatPatterns = seats.map(seat =>
                    new RegExp(`^${seat.replace(/[+]/g, '\\+')}$`, 'i')
                );
                condition['no_of_seats'] = { $in: seatPatterns };
            }

            if (startDate && endDate) {
                condition['added_on'] = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }

            const pipeline = [
                { $match: condition },
                {
                    $addFields: {
                        adjusted_added_on: {
                            $add: ["$added_on", 19800000] // 5.5 hours in ms
                        }
                    }
                },

                {
                    $group: {
                        _id: {
                            space_type: "$space_type",
                            dayOfWeek: { $dayOfWeek: "$adjusted_added_on" },
                            phone_number: "$other_info.phone_number"
                        }
                    }
                },

                {
                    $group: {
                        _id: {
                            space_type: "$_id.space_type",
                            dayOfWeek: "$_id.dayOfWeek"
                        },
                        count: { $sum: 1 }
                    }
                },

                // Sort by space type and day
                { $sort: { "_id.space_type": 1, "_id.dayOfWeek": 1 } }
            ];

            const results = await Enquiry.aggregate(pipeline);

            // Transform Mongo dayOfWeek (1=Sun...7=Sat) to 0=Mon...6=Sun
            const output = {};
            for (let i = 0; i < results.length; i++) {
                const { space_type, dayOfWeek } = results[i]._id;
                const count = results[i].count;
                const dayIndex = (dayOfWeek + 5) % 7; // Shift so Monday = 0

                if (!output[space_type]) {
                    output[space_type] = Array(7).fill(0);
                }
                output[space_type][dayIndex] = count;
            }

            return output;

        } catch (error) {
            throw error;
        }
    }


    async getVendorenquiries({ limit, skip, orderBy = -1, sortBy = 'added_on', interested_in, userid, startDate, endDate, exports, includeFields }) {
        try {
            const result = {};
            let condition = {};
            let flags;
            if (includeFields) {
                flags = JSON.parse(includeFields)
            }
            // Interested_in condition
            if (interested_in) {
                condition['interested_in'] = interested_in;
            }

            // Date filter handling
            const startDateString = startDate ? new Date(startDate) : null;
            const endDateString = endDate ? new Date(endDate) : null;
            if (startDateString && endDateString) {
                condition['added_on'] = {
                    $gte: startDateString,
                    $lte: endDateString
                };
            }

            // Fetch workspace, living space, and office space ids
            const workspaces = await WorkSpace.find({ user: userid }, { _id: 1 });
            const livingspaces = await CoLivingSpace.find({ user: userid }, { _id: 1, 'location.micro_location': 1 }).populate('location.micro_location');
            const officespaces = await OfficeSpace.find({ user: userid }, { _id: 1 });
            let locations;
            if (livingspaces) {
                locations = livingspaces.flatMap((item) =>
                    item.location && item.location.micro_location
                        ? item.location.micro_location.map((loc) => loc.name)
                        : []
                );
            }
            if (locations && locations.length > 0) {
                condition['location'] = {
                    '$elemMatch': { '$regex': locations.join('|'), '$options': 'i' }
                };
            }
            const workspaceIds = workspaces.map(ws => ws._id);
            const livingspaceIds = livingspaces.map(ls => ls._id);
            const officespaceIds = officespaces.map(os => os._id);

            // Construct the $or condition for spaces
            // condition['$or'] = [
            //     { 'work_space': { "$in": workspaceIds } },
            //     { 'living_space': { "$in": livingspaceIds } },
            //     { 'office_space': { "$in": officespaceIds } }
            // ];
            result.enquiries = await Enquiry.find(condition)
                .populate('work_space')
                .populate('living_space')
                .populate('office_space')
                .limit(limit)
                .skip(skip)
                .sort({
                    [sortBy]: orderBy
                });

            result.count = await Enquiry.countDocuments(condition);
            // Export logic
            if (exports) {
                const fields = [];
                let enquiries = result.enquiries.filter((result) => result.space_type === 'Web Coliving');
                const mappedEnquiries = enquiries.map(enquiry => {
                    const obj = enquiry.toObject();
                    if (obj.other_info && obj.other_info.phone_number) {
                        obj.other_info.phone_number = obj.other_info.phone_number.replace(/^\+91-/, '');
                    }

                    // Map data based on flags
                    const mappedData = {};
                    if (flags.includeName) {
                        fields.push("Name");
                        mappedData["Name"] = obj?.other_info?.name;
                    }
                    if (flags.includeEmail) {
                        fields.push("Email");
                        mappedData["Email"] = obj?.other_info?.email;
                    }
                    if (flags.includePhoneNumber) {
                        fields.push("Phone Number");
                        mappedData["Phone Number"] = obj?.other_info?.phone_number;
                    }
                    if (flags.includeInterestedIn) {
                        fields.push("Interested In");
                        mappedData["Interested In"] = obj?.interested_in;
                    }
                    if (flags.includeSpaceType) {
                        fields.push("Space Type");
                        mappedData["Space Type"] = obj?.space_type;
                    }
                    if (flags.includeCity) {
                        fields.push("City");
                        mappedData["City"] = obj?.city;
                    }
                    if (flags.includeLocation) {
                        fields.push("Location");
                        mappedData["Location"] = obj?.microlocation;
                    }
                    if (flags.includeAddress) {
                        fields.push("Address");
                        mappedData["Address"] = obj?.address;
                    }
                    if (flags.includeLeadId) {
                        fields.push("Lead ID");
                        mappedData["Lead ID"] = obj?.lead_id;
                    }
                    if (flags.includeNoOfSeats) {
                        fields.push("Number of Seats");
                        mappedData["Number of Seats"] = obj?.no_of_seats;
                    }
                    if (flags.includeBudget) {
                        fields.push("Budget");
                        mappedData["Budget"] = obj?.budget;
                    }
                    if (flags.includePageUrl) {
                        fields.push("Page URL");
                        mappedData["Page URL"] = obj?.page_url;
                    }
                    if (flags.includeStatus) {
                        fields.push("Status");
                        mappedData["Status"] = obj?.status;
                    }
                    if (flags.includeAddedOn) {
                        const addedOnDate = new Date(obj.added_on);
                        const formattedDate = addedOnDate.toLocaleDateString();
                        fields.push("Date");
                        mappedData["Date"] = formattedDate;
                    }
                    if (flags.includeTime) {
                        const addedOnTime = new Date(obj.added_on);
                        const formattedTime = addedOnTime.toLocaleTimeString();
                        fields.push("Time");
                        mappedData["Time"] = formattedTime;
                    }

                    return mappedData;
                });

                // Ensure fields are unique
                const uniqueFields = [...new Set(fields)];
                const json2csvParser = new Json2CsvParser({ fields: uniqueFields });
                const csv = json2csvParser.parse(mappedEnquiries);
                return csv;
            } else {
                return result;
            }
        } catch (error) {
            throw error;
        }
    }


    async changeStatus({ id, status }) {
        try {
            const enquiry = await Enquiry.findOneAndUpdate({ _id: id }, { status });
            return enquiry;
        } catch (error) {
            throw (error);
        }
    }

    _throwException(message) {
        throw ({
            name: "cofynd",
            code: 400,
            message
        })
    }
}

export default new ManageEnquiryService();