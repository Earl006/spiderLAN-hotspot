import BuildingService from "../services/building.service";


export class BuildingController {
    private buildingService: BuildingService;

    constructor() {
        this.buildingService = new BuildingService();
    }

    createBuilding = async (req: any, res: any) => {
        try {
            const building = await this.buildingService.createBuilding(req.body);
            res.status(201).json({ message: 'Building created successfully', building });
            console.log('Building created successfully');
        } catch (error: any) {
            res.status(400).json({ message: error.message });
            console.log('Building creation failed');
        }
    };

    getAllBuildings = async (req: any, res: any) => {
        try {
            const buildings = await this.buildingService.getAllBuildings();
            res.json(buildings);
            console.log('All buildings fetched');
        } catch (error: any) {
            res.status(400).json({ message: error.message });
            console.log('Buildings not found');
        }
    }

    getBuildingById = async (req: any, res: any) => {
        try {
            const buildingId = req.params.buildingId;
            const building = await this.buildingService.getBuildingById(buildingId);
            res.json(building);
            console.log('Building found');
        } catch (error: any) {
            res.status(400).json({ message: error.message });
            console.log('Building not found');
        }
    }

    updateBuilding = async (req: any, res: any) => {
        try {
            const building = await this.buildingService.updateBuilding(req.body, req.body.buildingId);
            res.status(200).json({ message: 'Building updated successfully', building });
            console.log('Building updated successfully');
        } catch (error: any) {
            res.status(400).json({ message: error.message });
            console.log('Building update failed');
        }
    }

    deleteBuilding = async (req: any, res: any) => {
        try {
            await this.buildingService.deleteBuilding(req.body.buildingId);
            res.status(200).json({ message: 'Building deleted successfully' });
            console.log('Building deleted successfully');
        } catch (error: any) {
            res.status(400).json({ message: error.message });
            console.log('Building deletion failed');
        }
    }
}