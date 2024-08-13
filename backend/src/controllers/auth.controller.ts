import { log } from "console";
import AuthService from "../services/auth.service";

export class AuthController {
    private authService: AuthService;

    constructor() {
        this.authService = new AuthService();
    }

    registerUser = async (req: any, res: any) => {
        try {
            const user = await this.authService.registerUser(req.body);
            res.status(201).json({message:'Registration succesfull!!',user});
            console.log('Registration succesfull!!');
            
        } catch (error: any) {
            res.status(400).json({ message: error.message });
            console.log('Registration failed!!');
            
        }
    };

    loginUser = async (req: any, res: any) => {
        try {
            const { user, token } = await this.authService.loginUser(req.body);
            res.status(200).json({ message:'Login successfull!!',token });
            console.log('Login succesfull!!');
        } catch (error: any) {
            res.status(400).json({ message: error.message });
            console.log('Login failed!!');
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