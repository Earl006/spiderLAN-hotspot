import { PrismaClient } from '@prisma/client';
import IntaSend from 'intasend-node';
import SubscriptionService from '../services/subscription.service';
import dotenv from 'dotenv';

dotenv.config();

export class PaymentService {
  private readonly intasend: any;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly subscriptionService: SubscriptionService
  ) {
    const publishableKey = process.env.INTASEND_PUBLISHABLE_KEY ?? 'default_publishable_key';
    const secretKey = process.env.INTASEND_SECRET_KEY ?? 'default_secret_key';
    this.intasend = new IntaSend(publishableKey, secretKey, true);
  }

  async initiatePayment(planId: string, userId: string, phoneNumber: string) {
    try {
      const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
      if (!plan) throw new Error('Plan not found');

      const amount = plan.price;

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');

      // Initiate payment using IntaSend SDK
      const response = await this.intasend.collection().mpesaStkPush({
        first_name: user.name ? user.name.split(' ')[0] : '',
        last_name: user.name ? user.name.split(' ')[1] || '' : '',
        email: user.email,
        host: 'https://yourwebsite.com',
        amount,
        phone_number: phoneNumber,
        api_ref: `subscription_${plan.name}_for ${user.name}`,
      });

      // Save payment initiation data
      const payment = await this.prisma.payment.create({
        data: {
          userId,
          planId,
          amount,
          status: 'PENDING',
          invoiceId: response.invoice.invoice_id,
        },
      });

      // Automate status check after a delay (e.g., 60 seconds)
      setTimeout(async () => {
        try {
          await this.checkPaymentStatus(response.invoice.invoice_id);
        } catch (error) {
          console.error('Error during automated status check:', error);
        }
      }, 60000); // 60 seconds delay

      return { paymentResponse: response, message: 'Payment initiated successfully', paymentId: payment.id };
    } catch (error) {
      // Save the failed payment attempt
      await this.prisma.payment.create({
        data: {
          userId,
          planId,
          amount: 0,
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw new Error(`Payment initiation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Method to check payment status and update accordingly
  private async checkPaymentStatus(invoiceId: string) {
    try {
      const paymentStatus = await this.intasend.collection().status(invoiceId);

      if (paymentStatus.invoice.state === 'COMPLETE') {
        await this.createSubscriptionFromPayment(invoiceId);
      } else if (paymentStatus.invoice.state === 'CANCELLED') {
        await this.prisma.payment.update({
          where: { invoiceId },
          data: { status: 'FAILED' },
        });
        console.log('Payment was cancelled.');
      } else {
        // Update the payment status in the database for any other state
        await this.prisma.payment.update({
          where: { invoiceId },
          data: { status: paymentStatus.invoice.state },
        });
        console.log(`Payment status updated to: ${paymentStatus.invoice.state}`);
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      await this.prisma.payment.update({
        where: { invoiceId },
        data: { status: 'FAILED', errorMessage: error instanceof Error ? error.message : 'Unknown error' },
      });
    }
  }

  // Method to create a subscription if payment is successful
  private async createSubscriptionFromPayment(invoiceId: string) {
    try {
      const payment = await this.prisma.payment.findUnique({ where: { invoiceId } });
      if (!payment) throw new Error('Payment not found');

      const { planId, userId } = payment;

      await this.subscriptionService.createSubscription(userId, planId);

      // Update the payment status in the database to SUCCESS
      await this.prisma.payment.update({
        where: { invoiceId },
        data: { status: 'SUCCESS' },
      });

      console.log('Subscription created successfully.');
    } catch (error) {
      console.error('Error creating subscription from payment:', error);
      throw new Error('Failed to create subscription from payment');
    }
  }
}
