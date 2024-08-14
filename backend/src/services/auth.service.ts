import { PrismaClient, User as PrismaUser } from '@prisma/client';
import { generateToken, verifyToken } from '../utils/jwt.utils';
import bcrypt from 'bcryptjs';  // Fixed typo from 'bycryptjs' to 'bcryptjs'
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export default class AuthService {
    // Remove the placeholder method
    // static getUserById(userId: string) {
    //     throw new Error('Method not implemented.');
    // }

    async registerUser(data: PrismaUser) {
        // Check if phone number already exists
        const phoneExists = await prisma.user.findUnique({
            where: {
                phoneNumber: data.phoneNumber
            }
        });

        if (phoneExists) {
            throw new Error('User with that phone number already exists');
        }

        // Check if email already exists
        const emailExists = await prisma.user.findUnique({
            where: {
                email: data.email
            }
        });

        if (emailExists) {
            throw new Error('User with that email already exists');
        }

        // Create new user
        const user = await prisma.user.create({
            data: {
                ...data,
                password: bcrypt.hashSync(data.password, 10),
                id: uuidv4()
            }
        });

        return user;
    }

    async loginUser(data: { email: string; password: string }) {
        // Find user by email
        const user = await prisma.user.findUnique({
            where: {
                email: data.email
            }
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Check password
        if (!bcrypt.compareSync(data.password, user.password)) {
            throw new Error('Invalid password');
        }

        // Generate token
        const token = generateToken({ userId: user.id });

        return { user, token };
    }

    async changePassword(data: { oldPassword: string; newPassword: string }, userId: string) {
        // Find user by ID
        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Check old password
        if (!bcrypt.compareSync(data.oldPassword, user.password)) {
            throw new Error('Invalid password');
        }

        // Update password
        await prisma.user.update({
            where: {
                id: userId
            },
            data: {
                password: bcrypt.hashSync(data.newPassword, 10)
            }
        });
    }

    async getUserById(userId: string): Promise<PrismaUser | null> {
        if (!userId) {
            throw new Error('User ID is required');
        }

        // Fetch user by ID
        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        });

        if (!user) {
            return null; // Handle null values
        }

        return user;
    }
}
