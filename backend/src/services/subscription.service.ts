import { PrismaClient, Router, Subscription, User, Plan } from '@prisma/client';
import RouterManager from '../bg-services/router.manager';

const prisma = new PrismaClient();

export default class SubscriptionService {
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

  private async performRouterOperation<T>(
    router: Router,
    operation: (routerManager: RouterManager) => Promise<T>
  ): Promise<T> {
    try {
      await this.initializeRouterManager(router);
      return await operation(this.routerManager!);
    } finally {
      await this.closeRouterManagerConnection();
    }
  }

  async createSubscription(userId: string, planId: string): Promise<Subscription> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        // include: { building: { include: { routers: true } } },
      });
      // if (!user || !user.building.routers[0]) throw new Error('User or router not found');

      const plan = await prisma.plan.findUnique({ where: { id: planId } });
      if (!plan) throw new Error('Plan not found');

      const now = new Date();
      const endDate = new Date(now.getTime() + plan.duration * 1000);

      const subscription = await prisma.subscription.create({
        data: {
          userId,
          planId,
          startDate: now,
          endDate: endDate,
          isActive: true,
        },
      });

      // try {
      //   await this.performRouterOperation(user.building.routers[0], async (routerManager) => {
      //     const assignedIP = await routerManager.assignIPAddress(userId);
      //     console.log(`Assigned IP ${assignedIP} to user ${userId}`);
      //     await routerManager.enableAccess(userId);
      //     console.log(`Enabled access for user ${userId}`);
      //   });
      // } catch (error) {
      //   console.error('Failed to configure router for new subscription:', error);
      //   // Rollback subscription creation
      //   await prisma.subscription.delete({ where: { id: subscription.id } });
      //   throw new Error('Failed to configure router for new subscription');
      // }

      return subscription;
    } catch (error) {
      console.error('Failed to create subscription:', error);
      throw error;
    }
  }

  // async checkAndDisableExpiredSubscriptions(): Promise<void> {
  //   try {
  //     const expiredSubscriptions = await prisma.subscription.findMany({
  //       where: {
  //         endDate: { lte: new Date() },
  //         isActive: true,
  //       },
  //       include: {
  //         user: {
  //           // include: { building: { include: { routers: true } } },
  //         },
  //       },
  //     });

  //     // Group subscriptions by router
  //     const subscriptionsByRouter = expiredSubscriptions.reduce((acc, subscription) => {
  //       const router = subscription.user.building.routers[0];
  //       if (router) {
  //         if (!acc[router.id]) acc[router.id] = { router, subscriptions: [] };
  //         acc[router.id].subscriptions.push(subscription);
  //       }
  //       return acc;
  //     }, {} as Record<string, { router: Router; subscriptions: typeof expiredSubscriptions }>);

  //     for (const { router, subscriptions } of Object.values(subscriptionsByRouter)) {
  //       await this.performRouterOperation(router, async (routerManager) => {
  //         for (const subscription of subscriptions) {
  //           try {
  //             await routerManager.disableAccess(subscription.user.id);
  //             console.log(`Disabled access for user ${subscription.user.id}`);
              
  //             await prisma.subscription.update({
  //               where: { id: subscription.id },
  //               data: { isActive: false },
  //             });
  //             console.log(`Marked subscription ${subscription.id} as inactive`);
  //           } catch (error) {
  //             console.error(`Failed to disable access for user ${subscription.user.id}:`, error);
  //             // Continue processing other subscriptions
  //           }
  //         }
  //       });
  //     }

  //     console.log('Expired subscriptions have been processed');
  //   } catch (error) {
  //     console.error('Failed to process expired subscriptions:', error);
  //     throw error;
  //   }
  // }

  // async updateBandwidthUsage(subscriptionId: string, usage: number): Promise<void> {
  //   try {
  //     const subscription = await prisma.subscription.findUnique({
  //       where: { id: subscriptionId },
  //       include: {
  //         plan: true,
  //         user: {
  //           include: { building: { include: { routers: true } } },
  //         },
  //       },
  //     });

  //     if (!subscription || !subscription.user.building.routers[0]) throw new Error('Subscription or router not found');

  //     const updatedBandwidth = subscription.plan.bandwidth - usage;

  //     if (updatedBandwidth <= 0) {
  //       await this.performRouterOperation(subscription.user.building.routers[0], async (routerManager) => {
  //         await routerManager.disableAccess(subscription.user.id);
  //         console.log(`Disabled access for user ${subscription.user.id} due to bandwidth overuse`);
  //       });

  //       await prisma.subscription.update({
  //         where: { id: subscriptionId },
  //         data: { isActive: false },
  //       });

  //       console.log(`Subscription ${subscriptionId} expired due to bandwidth overuse`);
  //     } else {
  //       console.log(`Updated bandwidth usage for subscription ${subscriptionId}, remaining bandwidth: ${updatedBandwidth}`);
  //     }
  //   } catch (error) {
  //     console.error('Failed to update bandwidth usage:', error);
  //     throw error;
  //   }
  // }

  // async renewSubscription(subscriptionId: string): Promise<Subscription> {
  //   try {
  //     const subscription = await prisma.subscription.findUnique({
  //       where: { id: subscriptionId },
  //       include: {
  //         plan: true,
  //         user: {
  //           include: { building: { include: { routers: true } } },
  //         },
  //       },
  //     });

  //     if (!subscription || !subscription.user.building.routers[0]) throw new Error('Subscription or router not found');

  //     const now = new Date();
  //     const newEndDate = new Date(now.getTime() + subscription.plan.duration * 1000);

  //     const renewedSubscription = await prisma.subscription.update({
  //       where: { id: subscriptionId },
  //       data: {
  //         startDate: now,
  //         endDate: newEndDate,
  //         isActive: true,
  //       },
  //     });

  //     await this.performRouterOperation(subscription.user.building.routers[0], async (routerManager) => {
  //       await routerManager.enableAccess(subscription.user.id);
  //       console.log(`Re-enabled access for user ${subscription.user.id} after subscription renewal`);
  //     });

  //     return renewedSubscription;
  //   } catch (error) {
  //     console.error('Failed to renew subscription:', error);
  //     throw error;
  //   }
  // }
}