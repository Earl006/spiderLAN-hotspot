import { Request, Response } from 'express';
import routerService from '../services/router.service';

class RouterController {
  async addRouter(req: Request, res: Response) {
    try {
      const { buildingId, name, ip, username, password } = req.body;
      const router = await routerService.addRouter(buildingId, name, ip, username, password);
      res.status(201).json({ message: 'Router added successfully', router });
    } catch (error) {
      res.status(500).json({ error: 'Failed to add router' });
    }
  }

  async updateRouter(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const data = req.body;
      const router = await routerService.updateRouter(id, data);
      res.json({ message: 'Router updated successfully', router });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update router' });
    }
  }

  async deleteRouter(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await routerService.deleteRouter(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete router' });
    }
  }

  async getAllRouters(req: Request, res: Response) {
    try {
      const routers = await routerService.getAllRouters();
      res.json({ message: 'Routers fetched successfully', routers });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get routers' });
    }
  }

  async getRouterById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const router = await routerService.getRouterById(id);
      if (router) {
        res.json({ message: 'Router fetched successfully', router });
      } else {
        res.status(404).json({ error: 'Router not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get router' });
    }
  }

  async getConnectedUsers(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const users = await routerService.getConnectedUsers(id);
      res.json({ message: 'Connected users fetched successfully', users });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get connected users' });
    }
  }
}

export default new RouterController();
