import { PrismaClient, Router } from '@prisma/client';
import RouterManager from '../bg-services/router.manager';
import path from 'node:path';

const prisma = new PrismaClient();

class RouterService {
  private routerManager: RouterManager | null = null;

  private async initializeRouterManager(router: { id?: string; buildingId: string; name: string; ip: string; username: string; password: string; createdAt?: Date; updatedAt?: Date; }): Promise<void> {
        this.routerManager = new RouterManager(router.ip, router.username, router.password);
        await this.routerManager.connect();
    }

  private async closeRouterManagerConnection(): Promise<void> {
    if (this.routerManager) {
      await this.routerManager.disconnect();
      this.routerManager = null;
    }
  }

  async addRouter(
    buildingId: string,
    name: string,
    ip: string = '192.168.56.33',
    username: string,
    password: string
  ) {
    let router;
    try {
      router = { buildingId, name, ip, username, password };
      await this.initializeRouterManager(router);
  
      if (this.routerManager) {
        try {
          // Setup hotspot configurations
          await this.routerManager.setupHotspotConfigurations();
          console.log('Hotspot configurations completed successfully');
  
          // Upload template
          const templatePath = path.join(__dirname, '../bg-services/templates/login.html');
          await this.routerManager.uploadHotspotTemplate(templatePath);
          console.log('Template uploaded successfully');
  
  
        } catch (setupError) {
          console.error('Error setting up router:', setupError);
          throw setupError;
        }
      }
  
      // Save to database
      router = await prisma.router.create({
        data: {
          buildingId,
          name,
          ip,
          username,
          password,
        },
      });
  
      console.log('Router added to database successfully');
      return router;
    } catch (error) {
      console.error('Failed to add router:', error);
      throw error;
    } finally {
      await this.closeRouterManagerConnection();
    }
  }

  async updateRouter(id: string, data: { name?: string; ip?: string; username?: string; password?: string }) {
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

  async deleteRouter(id: string) {
    try {
      return await prisma.router.delete({
        where: { id },
      });
    } catch (error) {
      console.error('Failed to delete router:', error);
      throw error;
    }
  }

  async getAllRouters() {
    try {
      return await prisma.router.findMany();
    } catch (error) {
      console.error('Failed to get all routers:', error);
      throw error;
    }
  }

  async getRouterById(id: string) {
    try {
      return await prisma.router.findUnique({
        where: { id },
      });
    } catch (error) {
      console.error('Failed to get router:', error);
      throw error;
    }
  }

  async getRouterByBuildingId(buildingId: string) {
    try {
      return await prisma.router.findFirst({
        where: { buildingId },
      });
    } catch (error) {
      console.error('Failed to get router by building ID:', error);
      throw error;
    }
  }

  async getConnectedUsers(routerId: string) {
    try {
      const router = await this.getRouterById(routerId);
      if (!router) {
        throw new Error('Router not found');
      }

      await this.initializeRouterManager(router);

      if (this.routerManager) {
        const connectedUsers = await this.routerManager.getConnectedUsers();
        return connectedUsers;
      } else {
        throw new Error('RouterManager not initialized');
      }
    } catch (error) {
      console.error('Failed to get connected users:', error);
      throw error;
    } finally {
      await this.closeRouterManagerConnection();
    }
  }
}

export default new RouterService();
