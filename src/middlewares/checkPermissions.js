import Admin from '../models/Admin';

export default async function validate(req, res, next) {
    const routePath = req.path.split('/');
    if (req.path.includes('/login')) return next();
    let response = {
        type: 'Error',
        message: 'Unauthoried'
    }
    if (!req.admin) {
        return res.status(403).json(response)
    }

    const isSuperAdmin = await Admin.findOne({
        where: {
            _id: req.admin.id,
            is_super_admin: true
        }
    })
    if (isSuperAdmin) return next();
    const route = routePath[1];
    const permissionExists = await Permission.findOne({
        where: {
            name: route
        }
    })
    if (!permissionExists) return next();
    const permited = await PermissionRole.findOne({
        where: {
            role_id: req.admin.role,
            permission_id: permissionExists.id
        }
    });
    if (permited) {
        return next();
    } else {
        return res.status(403).json(response)
    }
}