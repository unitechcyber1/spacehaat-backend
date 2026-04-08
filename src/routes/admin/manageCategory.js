import { Router } from 'express';
const router = Router();
import ManageCategory from '../../controllers/admin/ManageCategory.js';

router.get('/categorys', ManageCategory.getCategorys)
    .post('/category', ManageCategory.addOrEditCategory)
    .put('/category/:categoryId', ManageCategory.addOrEditCategory)
    .get('/category/:id', ManageCategory.getCategoryById)
    .get('/Active_category', ManageCategory.ActiveCategory)
    .get('/category/changeStatus/:categoryId', ManageCategory.toggleCategoryStatus)
    .delete('/category/:categoryId', ManageCategory.deleteCategory)

export default router;
