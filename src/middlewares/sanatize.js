export default function (req, res, next) {
    if (req.method == 'GET') {
        let { limit, orderBy, page, sortBy } = req.query;
        req.query.limit = Number(limit) || 10;
        page = Number(page) || 1;
        req.query.skip = req.query.limit * (page - 1);
        req.query.orderBy = Number(orderBy) || 1;
        req.query.sortBy = sortBy && sortBy.trim() ? sortBy : undefined
    }
    const adminId = req.admin && req.admin.id ? req.admin.id : false;
    if (adminId) {
        switch (req.method) {
            case "DELETE": {
                req.body.updated_by = adminId;
                break;
            };
            case "POST": {
                req.body.added_by = adminId;
                break;
            };
            case "PUT": {
                req.body.updated_by = adminId;
                break;
            };
        }
    }
    next()
}