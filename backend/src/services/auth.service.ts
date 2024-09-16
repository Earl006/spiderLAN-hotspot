import { PrismaClient, User as PrismaUser } from '@prisma/client';
import { generateToken } from '../utils/jwt.utils';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';

const prisma = new PrismaClient();

export default class AuthService {
    async registerUser(data: PrismaUser, req: Request) {
        console.log(`Attempting to register user with phone number: ${data.phoneNumber} and email: ${data.email}`);

        const phoneExists = await prisma.user.findUnique({
            where: { phoneNumber: data.phoneNumber }
        });
        if (phoneExists) {
            console.error(`Registration failed: User with phone number ${data.phoneNumber} already exists`);
            throw new Error('User with that phone number already exists');
        }

        const emailExists = await prisma.user.findUnique({
            where: { email: data.email }
        });
        if (emailExists) {
            console.error(`Registration failed: User with email ${data.email} already exists`);
            throw new Error('User with that email already exists');
        }

        // Temporarily use hardcoded IP and MAC addresses
        const ipAddress = '192.168.1.1';
        const macAddress = '00:00:00:00:00:00';
        console.log(`Using hardcoded IP: ${ipAddress}, MAC: ${macAddress} for new user registration`);

        const user = await prisma.user.create({
            data: {
                ...data,
                password: bcrypt.hashSync(data.password, 10),
                id: uuidv4(),
                ipAddress,
                macAddress
            }
        });
        console.log(`User registered successfully with ID: ${user.id}, Phone: ${user.phoneNumber}, Email: ${user.email}`);

        return user;
    }

    async loginUser(data: { email: string; password: string }, req: Request) {
        console.log(`Attempting to log in user with email: ${data.email}`);

        const user = await prisma.user.findUnique({
            where: {
                email: data.email
            }
        });

        if (!user) {
            console.error(`Login failed: User with email ${data.email} not found`);
            throw new Error('User not found');
        }

        if (!bcrypt.compareSync(data.password, user.password)) {
            console.error(`Login failed: Invalid password for user with email ${data.email}`);
            throw new Error('Invalid password');
        }

        // Temporarily use hardcoded IP and MAC addresses
        const ipAddress = '192.168.1.1';
        const macAddress = '00:00:00:00:00:00';
        console.log(`Using hardcoded IP: ${ipAddress}, MAC: ${macAddress} for user login`);

        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                ipAddress,
                macAddress
            }
        });
        console.log(`Updated IP and MAC address for user with ID: ${user.id}`);

        const token = generateToken({ userId: user.id });
        console.log(`Generated token for user with ID: ${user.id}`);

        return { user, token };
    }

    async changePassword(data: { oldPassword: string; newPassword: string }, userId: string) {
        console.log(`Attempting to change password for user with ID: ${userId}`);

        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        });

        if (!user) {
            console.error(`Password change failed: User with ID ${userId} not found`);
            throw new Error('User not found');
        }

        if (!bcrypt.compareSync(data.oldPassword, user.password)) {
            console.error(`Password change failed: Invalid old password for user with ID ${userId}`);
            throw new Error('Invalid password');
        }

        await prisma.user.update({
            where: {
                id: userId
            },
            data: {
                password: bcrypt.hashSync(data.newPassword, 10)
            }
        });
        console.log(`Password updated successfully for user with ID: ${userId}`);
    }

    async getUserById(userId: string): Promise<PrismaUser | null> {
        if (!userId) {
            console.error('User ID is required to fetch user');
            throw new Error('User ID is required');
        }

        console.log(`Fetching user with ID: ${userId}`);

        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        });

        if (!user) {
            console.warn(`User with ID ${userId} not found`);
            return null;
        }

        console.log(`User with ID ${userId} fetched successfully`);
        return user;
    }
}