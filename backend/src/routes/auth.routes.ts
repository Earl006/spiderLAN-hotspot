import express from 'express';
import { AuthController } from '../controllers/auth.controller';
import {  isAuthenticated, } from '../middlewares/auth.middleware';


const router = express.Router();

const authController = new AuthController();

router.post('/register', authController.registerUser);
router.post('/login', authController.loginUser);
router.put('/change-password',isAuthenticated, authController.changePassword);
router.get('/user/:userId',isAuthenticated, authController.getUserById);


export default router;