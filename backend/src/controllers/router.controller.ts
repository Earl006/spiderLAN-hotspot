import { Request, Response } from 'express';
import routerService from '../services/router.service';

class RouterController {
  async addRouter(req: Request, res: Response) {
    try {
      const { buildingId, name, username, password } = req.body;
      const router = await routerService.addRouter(buildingId, name, username, password);
      res.status(201).json({message:'Router added succesfully',router});
      console.log('Router added succesfully');
      
    } catch (error) {
      res.status(500).json({ error: 'Failed to add router' });
      console.log('Failed to add router');
      
    }
  }

  async updateRouter(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const router = await routerService.updateRouter(id, { name });
      res.json({router,message:'Router updated succesfully'});
      console.log('Router updated succesfully');
      
    } catch (error) {
      res.status(500).json({ error: 'Failed to update router' });
        console.log('Failed to update router');
    }
  }

  async deleteRouter(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await routerService.deleteRouter(id);
      res.status(204).send();
      console.log('Router deleted succesfully');
      
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete router' });
        console.log('Failed to delete router');
    }
  }

  async getAllRouters(req: Request, res: Response) {
    try {
      const routers = await routerService.getAllRouters();
      res.json({routers,message:'Routers fetched succesfully'});
      console.log('Routers fetched succesfully');
      
    } catch (error) {
      res.status(500).json({ error: 'Failed to get routers' });
        console.log('Failed to get routers');
    }
  }

  async getRouterById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const router = await routerService.getRouterById(id);
      if (router) {
        res.json({router,message:'Router fetched succesfully'});
        console.log('Router fetched succesfully');
      } else {
        res.status(404).json({ error: 'Router not found' });
        console.log('Router not found');
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get router' });
        console.log('Failed to get router');
    }
  }

  async getConnectedUsers(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const users = await routerService.getConnectedUsers(id);
      res.json({users,message:'Connected users fetched succesfully'});
        console.log('Connected users fetched succesfully');
    } catch (error) {
      res.status(500).json({ error: 'Failed to get connected users' });
      console.log('Failed to get connected users');
      
    }
  }
}

export default new RouterController();