import { Request, Response } from 'express';
import planService from '../services/plan.service';

class PlanController {
  async createPlan(req: Request, res: Response) {
    try {
      const { name, duration, price, bandwidth } = req.body;
      const plan = await planService.createPlan(name, duration, price, bandwidth);
      res.status(201).json(plan);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create plan' });
    }
  }

  async updatePlan(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, duration, price, bandwidth } = req.body;
      const plan = await planService.updatePlan(id, { name, duration, price, bandwidth });
      res.json(plan);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update plan' });
    }
  }

  async deletePlan(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await planService.deletePlan(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete plan' });
    }
  }

  async getAllPlans(req: Request, res: Response) {
    try {
      const plans = await planService.getAllPlans();
      res.json(plans);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get plans' });
    }
  }

  async getPlanById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const plan = await planService.getPlanById(id);
      if (plan) {
        res.json(plan);
      } else {
        res.status(404).json({ error: 'Plan not found' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to get plan' });
    }
  }
}

export default new PlanController();