import { Request, Response } from "express";
import { log } from "console";
import AuthService from "../services/auth.service";

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    registerUser = async (req: Request, res: Response) => {
        try {
            const user = await this.authService.registerUser(req.body, req);
            res.status(201).json({ message: 'Registration successful!!', user });
            console.log('Registration successful!!');
        } catch (error: any) {
            res.status(400).json({ message: error.message });
            console.log('Registration failed!!');
        }
    }

    loginUser = async (req: Request, res: Response) => {
        try {
            const { email, password } = req.body;
            const result = await this.authService.loginUser({ email, password }, req);
            res.status(200).json(result);
        } catch (error: any) {
            res.status(400).json({ message: error.message });
        }
    }
    changePassword = async (req: any, res: any) => {
        try {
            await this.authService.changePassword(req.body, req.body.userId);
            res.status(200).json({ message: 'Password changed successfully' });
            console.log('Password changed successfully');
        } catch (error: any) {
            res.status(400).json({ message: error.message });
            console.log('Password change failed');
        }
    }
    getUserById = async (req: any, res: any) => {
        try {
            const userId = req.params.userId;
            const user = await this.authService.getUserById(userId);
            res.json(user);
            console.log('User found');
            
        } catch (error: any) {
            res.status(400).json({ message: error.message });
            console.log('User not found');
        }
    }
    }