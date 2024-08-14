import { BuildingController } from "../controllers/building.controller";
import express from 'express';
import { isAuthenticated, isAdmin } from '../middlewares/auth.middleware';

const router = express.Router();

const buildingController = new BuildingController();

router.post('/add', isAuthenticated, isAdmin, buildingController.createBuilding);
router.get('/', isAuthenticated, buildingController.getAllBuildings);
router.get('/:buildingId', isAuthenticated, buildingController.getBuildingById);
router.put('/:buildingId', isAuthenticated, isAdmin, buildingController.updateBuilding);
router.delete('/:buildingId', isAuthenticated, isAdmin, buildingController.deleteBuilding);

export default router;