import express from 'express';
import { UserController } from '../controllers/user.controller';
import { isAdmin, isAuthenticated} from '../middlewares/auth.middleware';

const router = express.Router();

const userController = new UserController();

router.get('/users/all',isAuthenticated, isAdmin, userController.getAllUsers);
router.get('/:userId',isAuthenticated, userController.getUser);
router.put('/:id',isAuthenticated,userController.updateUser);
router.delete('/:userId',isAuthenticated, userController.deleteUser);
router.get('/building/:buildingId',isAuthenticated,isAdmin, userController.getUsersByBuilding);
router.post('/request-password-reset', userController.requestPasswordReset);
router.post('/reset-password', userController.resetPassword);
router.put('/toggle-role/:userId',isAuthenticated,isAdmin, userController.toggleUserRole);

export default router;