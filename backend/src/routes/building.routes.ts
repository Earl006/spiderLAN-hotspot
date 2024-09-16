import { BuildingController } from "../controllers/building.controller";
import express from 'express';
import { isAuthenticated, isAdmin } from '../middlewares/auth.middleware';

const router = express.Router();

const buildingController = new BuildingController();

router.post('/add',  buildingController.createBuilding);
router.get('/', buildingController.getAllBuildings);
router.get('/:buildingId', isAuthenticated, buildingController.getBuildingById);
router.put('/:buildingId', isAuthenticated, isAdmin, buildingController.updateBuilding);
router.delete('/:buildingId', isAuthenticated, isAdmin, buildingController.deleteBuilding);

export default router;