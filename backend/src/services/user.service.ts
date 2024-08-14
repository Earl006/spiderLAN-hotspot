import { PrismaClient, User } from "@prisma/client";
import bcryptjs from "bcryptjs";
import { isAdmin } from "../middlewares/auth.middleware";

const prisma = new PrismaClient();

export const updateUser = async (id: string, data: Partial<User>) => {
    if (!id) {
        throw new Error('User ID is required');
    }
    return prisma.user.update({
        where: { id },
        data,
    });
};

export const deleteUser = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId
        }
    });
    if (!user) {
        throw new Error('User not found');
    }
    await prisma.user.delete({
        where: {
            id: userId
        }
    });
    return user;
}

export const getUser = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId
        }
    });
    if (!user) {
        throw new Error('User not found');
    }
    return user;
}

export const requestPasswordReset = async (phoneNumber: string) => {
    const user = await prisma.user.findFirst({
        where: {
            phoneNumber
        }
    });
    if (!user) {
        throw new Error('User with given phone number not found');
    }
    const generateResetCode: () => string = () => {
        return Math.floor(1000 + Math.random() * 9000).toString();
      };
  
      // Generate reset token
      const resetToken = generateResetCode();
      const resetTokenExpiry = new Date(Date.now() + 900000); // 15 minutes
  
      // Save reset token to user
    await prisma.user.update({
        where: { phoneNumber: phoneNumber },
        data: {
            resetToken,
            resetTokenExpiry: resetTokenExpiry.toISOString(),
        },
    });

    // await smsService.sendresetPasswordOTP(phoneNumber, resetToken);

    return user;
}

export const resetPassword = async (resetToken: string, newPassword: string): Promise<User> => {
    const user = await prisma.user.findFirst({
      where: {
        resetToken,
        resetTokenExpiry: { gt: new Date().toISOString() },
      },
    });

    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    // Hash new password
    const newPasswordHash = await bcryptjs.hash(newPassword, 10);

    // Update user with new password and clear reset token
    return prisma.user.update({
      where: { id: user.id },
      data: {
        password: newPasswordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
  }
export const getAllUsers = async () => {
    return prisma.user.findMany();
}

export const getUsersByBuilding = async (buildingId: string) => {
    return prisma.user.findMany({
        where: {
            buildingId
        }
    });
}

export const toggleUserRole = async (userId: string) => {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    });

    if (!user) {
        throw new Error('User not found');
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: {
            isAdmin: !user.isAdmin,  // Toggle the isAdmin field
        },
    });

    const message = updatedUser.isAdmin
        ? `${updatedUser.name || 'User'} is now an admin`
        : `${updatedUser.name || 'User'}'s admin privileges revoked`;

    return { message, updatedUser };
};

