import { PrismaClient, User } from "@prisma/client";
import { generateToken, verifyToken } from "../utils/jwt.utils";
import bycryptjs from "bcryptjs";   
import {v4 as uuidv4} from "uuid";


const prisma = new PrismaClient();

export default class AuthService {
    static getUserById(userId: string) {
        throw new Error('Method not implemented.');
    }
    async registerUser(data: User) {
        const phoneExists = await prisma.user.findUnique({
            where: {
                phoneNumber: data.phoneNumber
            }
        });

        if(phoneExists) {
            throw new Error('User with that phone number already exists');
        }
       
        const emailExists = await prisma.user.findUnique({
            where: {
                email: data.email
            }
        });
        if(emailExists) {
            throw new Error('User with that email already exists');
        }
        const user = await prisma.user.create({
            data: {
                ...data,
                password: bycryptjs.hashSync(data.password, 10),
                id: uuidv4()
            }
        });
          return user;
    }

    async loginUser(data: User) {
        const user = await prisma.user.findUnique({
            where: {
                email: data.email
            }
        });
        if(!user) {
            throw new Error('User not found');
        }
        if(!bycryptjs.compareSync(data.password, user.password)) {
            throw new Error('Invalid password');
        }
        const token = generateToken({userId: user.id});
        return {user, token};
    }

    async changePassword(data: {oldPassword: string, newPassword: string}, userId: string) {
        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        });
        if(!user) {
            throw new Error('User not found');
        }
        if(!bycryptjs.compareSync(data.oldPassword, user.password)) {
            throw new Error('Invalid password');
        }
        await prisma.user.update({
            where: {
                id: userId
            },
            data: {
                password: bycryptjs.hashSync(data.newPassword, 10)
            }
        });
    }
  async getUserById(userId: string) {
    if (!userId) {
        throw new Error('User ID is required');
    }
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        include: {
            building: true,
        }
    });
    if (!user) {
        throw new Error('User not found');
    }
    return user;

}

}