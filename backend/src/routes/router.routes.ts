import { Router } from 'express';
import routerController from '../controllers/router.controller';
import { isAuthenticated, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', isAuthenticated,isAdmin,routerController.addRouter);
router.put('/:id',isAuthenticated,isAdmin, routerController.updateRouter);
router.delete('/:id',isAuthenticated,isAdmin, routerController.deleteRouter);
router.get('/', routerController.getAllRouters);
router.get('/:id', routerController.getRouterById);
router.get('/:id/connected-users',isAuthenticated,isAdmin, routerController.getConnectedUsers);

export default router;