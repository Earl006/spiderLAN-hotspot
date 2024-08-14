import { PrismaClient } from '@prisma/client';
import RouterManager from '../bg-services/router.manager';

const prisma = new PrismaClient();

class RouterService {
  private routerManager: RouterManager;

  constructor() {
    // Initialize with default values, these will be overwritten when a router is selected
    this.routerManager = new RouterManager('192.168.88.1', '', '');
  }

  async addRouter(buildingId: string, name: string, username: string, password: string): Promise<any> {
    try {
      const router = await prisma.router.create({
        data: {
          buildingId,
          name,
          ip: '192.168.88.1', // Using the default MikroTik management IP
        },
      });

      // Initialize RouterManager with the new router's credentials
      this.routerManager = new RouterManager('192.168.88.1', username, password);
      await this.routerManager.connect();

      // Setup hotspot configurations
      await this.routerManager.setupHotspotConfigurations();

      await this.routerManager.disconnect();

      return router;
    } catch (error) {
      console.error('Failed to add router:', error);
      throw error;
    }
  }

  async updateRouter(id: string, data: { name?: string }): Promise<any> {
    try {
      return await prisma.router.update({
        where: { id },
        data,
      });
    } catch (error) {
      console.error('Failed to update router:', error);
      throw error;
    }
  }

  async deleteRouter(id: string): Promise<any> {
    try {
      return await prisma.router.delete({
        where: { id },
      });
    } catch (error) {
      console.error('Failed to delete router:', error);
      throw error;
    }
  }

  async getAllRouters(): Promise<any> {
    try {
      return await prisma.router.findMany();
    } catch (error) {
      console.error('Failed to get all routers:', error);
      throw error;
    }
  }

  async getRouterById(id: string): Promise<any> {
    try {
      return await prisma.router.findUnique({
        where: { id },
      });
    } catch (error) {
      console.error('Failed to get router:', error);
      throw error;
    }
  }

  async getConnectedUsers(routerId: string): Promise<string[]> {
    try {
      const router = await this.getRouterById(routerId);
      if (!router) {
        throw new Error('Router not found');
      }

      this.routerManager = new RouterManager('192.168.88.1', 'admin', 'password'); // You'll need to store and retrieve the actual username and password securely
      await this.routerManager.connect();

      const connectedUsers = await this.routerManager.getConnectedPaidUsers();

      await this.routerManager.disconnect();

      return connectedUsers;
    } catch (error) {
      console.error('Failed to get connected users:', error);
      throw error;
    }
  }
}

export default new RouterService();