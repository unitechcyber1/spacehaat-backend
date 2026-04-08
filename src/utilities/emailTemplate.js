import welcome from './templates/welcome.js';
import enquiry from './templates/enquiry.js';
import passBook from './templates/passbook.js';
import adminEnquiry from './templates/admin-enquiry.js';
import adminPassBook from './templates/admin-passbook.js';
import listing from './templates/listing.js';
import coliving_listing from './templates/coliving-listing.js';
import office_listing from './templates/office-listing.js';
import flat_listing from './templates/flat-listing.js';
import user_registered from './templates/user-register.js'
import otp from './templates/otp.js'
import leadRegister from './templates/leadRegister.js';
import virtualOfficeWelcome from './templates/virtual-office-welcome.js';
import virtualFirstReminder from './templates/virtual-first-reminder.js';
import virtualSecondReminder from './templates/virtual-second-reminder.js';
import virtualThirdReminder from './templates/virtual-third-reminder.js';
import virtualFourthReminder from './templates/virtual-fourth-reminder.js';
import colivingCredits from './templates/coliving-credits.js';
import virtualOfficeFollowups from './templates/virtual-office-followups.js';
import virtualOfficeOptions from './templates/virtual-office-options.js';

export default {
    "welcome": {
        html: welcome,
        subject: '🎉 Thank You for Listing with Cofynd!'
    },
    "virtual_office_welcome": {
        html: virtualOfficeWelcome,
        subject: '✅ Thank You for Your Inquiry on Cofynd!'
    },
    "virtual_office_options": {
        html: virtualOfficeOptions,
        subject: 'Govt-Compliant Virtual Office in {city} (Ready for GST & MCA)'
    },
    "virtual_first_reminder": {
        html: virtualFirstReminder,
        subject: 'Important Before Finalising Your Virtual Office'
    },
    "virtual_Office_followup": {
        html: virtualOfficeFollowups,
        subject: 'Regarding your virtual office enquiry!'
    },
    "virtual_second_reminder": {
        html: virtualSecondReminder,
        subject: 'Best {city} Location to Suit Your Business'
    },
    "virtual_third_reminder": {
        html: virtualThirdReminder,
        subject: 'Need any help with your Virtual Office setup?'
    },
    "virtual_fourth_reminder": {
        html: virtualFourthReminder,
        subject: 'Virtual Office on Hold ?'
    },
    "enquiry": {
        html: enquiry,
        subject: '✅ Thank You for Your Inquiry on Cofynd!'
    },
    "coliving_credits": {
        html: colivingCredits,
        subject: 'Thank You for Purchasing – {credits} Credits Added to Your Account'
    },
    "passBook": {
        html: passBook,
        subject: '{category} Booked at {centerName}'
    },

    "payment": {
        html: '',
        subject: ''
    },
    "adminEnquiry": {
        html: adminEnquiry,
        subject: 'New enquiry has been made by {userName}'
    },

    "adminPassBook": {
        html: adminPassBook,
        subject: '{category} Booked at {centerName}'
    },

    "listing": {
        html: listing,
        subject: 'New {spaceType} Added From {userName} In {city}'
    },

    "coliving_listing": {
        html: coliving_listing,
        subject: 'New {spaceType} Added From {userName} In {city}'
    },

    "office_listing": {
        html: office_listing,
        subject: 'New {spaceType} Added From {userName} In {city}'
    },

    "flat_listing": {
        html: flat_listing,
        subject: 'New {spaceType} Added From {userName} In {city}'
    },

    "user_registered": {
        html: user_registered,
        subject: '{name} Registered With CoFynd'
    },

    "otp": {
        html: otp,
        subject: 'Forgot Password With CoFynd'
    },
    "leadRegister": {
        html: leadRegister,
        subject: 'Lead Register With CoFynd'
    },

    getTemplate(code, htmlVariables = {}, subjectVariables = {}) {
        let html = this.replaceVariables(htmlVariables, this[code]['html']);
        let subject = this.replaceVariables(subjectVariables, this[code]['subject']);
        return { html, subject }
    },
    replaceVariables(object, text) {
        let variables = Object.entries(object);
        variables.forEach((para) => {
            var find = '{' + para[0] + '}'
            var regExp = new RegExp(find, 'g')
            text = text.replace(regExp, para[1])
        })
        return text;
    }
}