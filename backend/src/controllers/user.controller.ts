import { resetPassword, getAllUsers, getUser, updateUser, deleteUser,getUsersByBuilding,toggleUserRole, requestPasswordReset } from "../services/user.service";
import { Request, Response } from "express";

export class UserController {
    async getAllUsers(req: Request, res: Response) {
        try {
            const users = await getAllUsers();
            res.status(200).json(users);
            console.log('Users fetched successfully');
        } catch (error: any) {
            res.status(400).json({ message: error.message });
            console.log('Users fetch failed');
            
        }
    }

    async getUser(req: Request, res: Response) {
        try {
            const user = await getUser(req.params.userId);
            res.status(200).json(user);
            console.log('User fetched successfully');
        } catch (error: any) {
            res.status(400).json({ message: error.message });
            console.log('User fetch failed');
        }
    }

     async updateUser(req: Request, res: Response){
        try {
          const { id } = req.params;
          const data = req.body;
          const user = await updateUser(id, data);
          res.status(200).json({user, message: 'User updated successfully'});
          console.log('User updated successfully');
          
        } catch (error: any) {
           res.status(500).json({ error: error.message });
              console.log('User update failed');
        }
      }

    async deleteUser(req: Request, res: Response) {
        try {
            const user = await deleteUser(req.params.userId);
            res.status(200).json({user, message: 'User deleted successfully'});
            console.log('User deleted successfully');
        } catch (error: any) {
            res.status(400).json({ message: error.message });
            console.log('User delete failed');
        }
    }

    async requestPasswordReset(req: Request, res: Response) {
        try {
            const {phoneNumber} = req.body;
            await requestPasswordReset(phoneNumber);
            res.status(200).json({ message: 'Password reset code sent successfully to ' + phoneNumber });
            console.log('Password reset code sent successfully');
        } catch (error: any) {
            res.status(400).json({ message: error.message });
            console.log('Password reset request failed');
        }
    }

    async resetPassword(req: Request, res: Response) {
       try{
              const {resetToken, newPassword} = req.body;
                await resetPassword(resetToken, newPassword);
              res.status(200).json({ message: 'Password reset successfully'  });
              console.log('Password reset successfully');
       }
         catch(error: any){
                  res.status(400).json({ message: error.message });
                  console.log('Password reset failed');
         }
    }
    async getUsersByBuilding(req: Request, res: Response) {
        try {
            const buildingId = req.params.buildingId;
            const usersByBuilding = await getUsersByBuilding(buildingId);
            res.status(200).json({usersByBuilding, message: 'Users fetched successfully'});
            console.log('Users fetched successfully');
        } catch (error: any) {
            res.status(400).json({ message: error.message });
            console.log('Users fetch failed');
        }
    }

    async toggleUserRole(req: Request, res: Response) {
        try {
            const userId = req.params.userId;
            const {updatedUser,message} = await toggleUserRole(userId);
            res.status(200).json({ updatedUser,message });
            console.log('User role toggled successfully');
        } catch (error: any) {
            res.status(400).json({ message: error.message });
            console.log('User role toggle failed');
        }
    }
  

}