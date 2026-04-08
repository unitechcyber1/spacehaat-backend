import { Router } from 'express';
const router = Router();
import manageEnquiry from '../../controllers/admin/ManageEnquiry.js';

router.get('/enquiries', manageEnquiry.getEnquiries)
    .get('/enquiry/:id', manageEnquiry.getEnquiryById) // TODO take a decision whether it wil be here or delete
    .get('/leadCount', manageEnquiry.getEnquiryCount)
    .post('/enquiry/changeStatus/:id', manageEnquiry.changeStatus)
    .get('/getVendorenquiries', manageEnquiry.getVendorenquiries)
    .delete('/deletelead/:id', manageEnquiry.deleteLead)
    .delete('/deletemany', manageEnquiry.deleteManyLead)
    .get('/exportleads', manageEnquiry.exportLeads)
    .put('/update/lead', manageEnquiry.updateLeads)
    .put('/add/note', manageEnquiry.addNoteToLead)
    .put('/update/note', manageEnquiry.updateNoteInLead)
    .put('/delete/note', manageEnquiry.deleteNoteInLead)
    .post('/lead/add', manageEnquiry.createManualLead)
    .put('/lead/update', manageEnquiry.updateManualLead)
    .put('/leads/access', manageEnquiry.leadsAccess)
    .put('/leads/removeAccess', manageEnquiry.removeLeadsAccess)

export default router;