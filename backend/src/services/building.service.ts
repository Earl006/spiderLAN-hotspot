import { PrismaClient, Building } from "@prisma/client";
import {v4 as uuidv4} from "uuid";

const prisma = new PrismaClient();

export default class BuildingService {
    static getBuildingById(buildingId: string) {
        throw new Error('Method not implemented.');
    }
    async createBuilding(data: Omit<Building, 'id' | 'createdAt' | 'updatedAt'>): Promise<Building> {
        const existingBuilding = await prisma.building.findFirst({ where: { name: data.name } });
        if (existingBuilding) {
          throw new Error('Building with similar name already exists');
        }
        return prisma.building.create({ data });
      }

    async getAllBuildings() {
        const buildings = await prisma.building.findMany(
            {include:{routers:true}}
        );
        return buildings;
    }

    async getBuildingById(buildingId: string) {
        const building = await prisma.building.findUnique({
            where: {
                id: buildingId
            }, include: {routers:true}
        });
        return building;
    }

    async updateBuilding(data: Building, buildingId: string) {
        const building = await prisma.building.update({
            where: {
                id: buildingId
            },
            data: {
                ...data
            }
        });
        return building;
    }

    async deleteBuilding(buildingId: string) {
        const building = await prisma.building.delete({
            where: {
                id: buildingId
            }
        });
        return building;
    }
}