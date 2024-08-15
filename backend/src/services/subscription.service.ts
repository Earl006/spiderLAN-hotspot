import { PrismaClient, Router, Subscription } from '@prisma/client';
import RouterManager from '../bg-services/router.manager';

const prisma = new PrismaClient();

class SubscriptionService {
  private routerManager: RouterManager | null = null;

  private async initializeRouterManager(router: Router): Promise<void> {
    this.routerManager = new RouterManager(router.ip, router.username, router.password);
    await this.routerManager.connect();
  }

  private async closeRouterManagerConnection(): Promise<void> {
    if (this.routerManager) {
      await this.routerManager.disconnect();
      this.routerManager = null;
    }
  }

  async createSubscription(userId: string, planId: string): Promise<Subscription> {
    try {
      const plan = await prisma.plan.findUnique({ where: { id: planId } });
      if (!plan) throw new Error('Plan not found');

      const now = new Date();
      const endDate = new Date(now.getTime() + plan.duration * 1000); // Assuming duration is in seconds

      const subscription = await prisma.subscription.create({
        data: {
          userId,
          planId,
          startDate: now,
          endDate: endDate,
          isActive: true,
        },
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { building: { include: { routers: true } } },
      });

      if (!user || user.building.routers.length === 0) throw new Error('User or router not found');
      const router = user.building.routers[0];

      await this.initializeRouterManager(router);

      // Enable internet access for the user
      await this.routerManager!.enableAccess(user.id); // Or use a unique identifier for the user

      await this.closeRouterManagerConnection();

      return subscription;
    } catch (error) {
      console.error('Failed to create subscription:', error);
      throw error;
    }
  }

  async checkAndDisableExpiredSubscriptions(): Promise<void> {
    try {
      const expiredSubscriptions = await prisma.subscription.findMany({
        where: {
          endDate: { lte: new Date() },
          isActive: true,
        },
        include: {
          user: {
            include: { building: { include: { routers: true } } },
          },
        },
      });

      for (const subscription of expiredSubscriptions) {
        if (subscription.user.building.routers.length === 0) continue;
        const router = subscription.user.building.routers[0];

        await this.initializeRouterManager(router);

        // Disable internet access
        await this.routerManager!.disableAccess(subscription.user.id);

        await this.closeRouterManagerConnection();

        // Update subscription status to inactive
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { isActive: false },
        });
      }

      console.log('Expired subscriptions have been disabled');
    } catch (error) {
      console.error('Failed to disable expired subscriptions:', error);
      throw error;
    }
  }

  async updateBandwidthUsage(subscriptionId: string, usage: number): Promise<void> {
    try {
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          plan: true,
          user: {
            include: { building: { include: { routers: true } } },
          },
        },
      });

      if (!subscription) throw new Error('Subscription not found');

      const updatedBandwidth = subscription.plan.bandwidth - usage;

      if (updatedBandwidth <= 0) {
        if (subscription.user.building.routers.length === 0) throw new Error('Router not found');
        const router = subscription.user.building.routers[0];

        await this.initializeRouterManager(router);

        // Disable internet access
        await this.routerManager!.disableAccess(subscription.user.id);

        await this.closeRouterManagerConnection();

        // Update subscription status to inactive
        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: { isActive: false },
        });

        console.log('Subscription expired due to bandwidth overuse');
      } else {
        console.log('Bandwidth usage updated, remaining bandwidth:', updatedBandwidth);
      }
    } catch (error) {
      console.error('Failed to update bandwidth usage:', error);
      throw error;
    }
  }
}

export default new SubscriptionService();
