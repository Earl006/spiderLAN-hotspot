import { Router } from 'express';
import planController from '../controllers/plan.controller';
import { isAuthenticated, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.post('/',isAuthenticated,isAdmin, planController.createPlan);
router.put('/:id',isAuthenticated,isAdmin, planController.updatePlan);
router.delete('/:id',isAuthenticated,isAdmin, planController.deletePlan);
router.get('/', planController.getAllPlans);
router.get('/:id', planController.getPlanById);

export default router;