import listingIndexService from '../../services/user/listing-index.js';

class ListingIndex {
    constructor() {
        return {
            getListingIndex: this.getListingIndex.bind(this),
        };
    }

    async getListingIndex(req, res, next) {
        try {
            const data = await listingIndexService.getListingIndex();
            res.status(200).json({ message: 'Listing index', data });
        } catch (error) {
            next(error);
        }
    }
}

export default new ListingIndex();
