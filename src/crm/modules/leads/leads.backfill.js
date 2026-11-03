import { spaceCodeFromLabel } from '../../../models/Enquiry.js';

/** Fills the CRM fields on enquiries saved before they existed; `collection` is a driver collection. */
export async function backfillEnquiries(collection, { dryRun = false } = {}) {
    const enquiries = await collection
        .find({ spaceType: { $exists: false } }, { projection: { space_type: 1, added_on: 1 } })
        .toArray();
    if (dryRun || !enquiries.length) return enquiries.length;

    await collection.bulkWrite(
        enquiries.map((enquiry) => ({
            updateOne: {
                filter: { _id: enquiry._id },
                update: { $set: { spaceType: spaceCodeFromLabel(enquiry.space_type), leadDate: enquiry.added_on } },
            },
        })),
        { ordered: false },
    );
    return enquiries.length;
}
