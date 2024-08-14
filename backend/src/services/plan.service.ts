import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class PlanService {
  async createPlan(name: string, duration: number, price: number, bandwidth: number): Promise<any> {
    try {
      return await prisma.plan.create({
        data: {
          name,
          duration,
          price,
          bandwidth,
        },
      });
    } catch (error) {
      console.error('Failed to create plan:', error);
      throw error;
    }
  }

  async updatePlan(id: string, data: { name?: string; duration?: number; price?: number; bandwidth?: number }): Promise<any> {
    try {
      return await prisma.plan.update({
        where: { id },
        data,
      });
    } catch (error) {
      console.error('Failed to update plan:', error);
      throw error;
    }
  }

  async deletePlan(id: string): Promise<any> {
    try {
      return await prisma.plan.delete({
        where: { id },
      });
    } catch (error) {
      console.error('Failed to delete plan:', error);
      throw error;
    }
  }

  async getAllPlans(): Promise<any> {
    try {
      return await prisma.plan.findMany();
    } catch (error) {
      console.error('Failed to get all plans:', error);
      throw error;
    }
  }

  async getPlanById(id: string): Promise<any> {
    try {
      return await prisma.plan.findUnique({
        where: { id },
      });
    } catch (error) {
      console.error('Failed to get plan:', error);
      throw error;
    }
  }
}

export default new PlanService();