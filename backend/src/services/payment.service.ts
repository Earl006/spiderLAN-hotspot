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

      // Start checking payment status
      const result = await this.checkPaymentStatusRecursive(response.invoice.invoice_id);

      return { paymentResponse: response, message: result.message, paymentId: payment.id };
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

  private async checkPaymentStatusRecursive(invoiceId: string, attempts: number = 0): Promise<{ status: string, message: string }> {
    if (attempts >= 5) { // 5 attempts * 60 seconds = 5 minutes
      await this.updatePaymentStatus(invoiceId, 'FAILED', 'Timeout after 5 minutes');
      return { status: 'FAILED', message: 'Payment failed: Timeout after 5 minutes' };
    }

    try {
      const paymentStatus = await this.intasend.collection().status(invoiceId);

      switch (paymentStatus.invoice.state) {
        case 'COMPLETE':
          await this.updatePaymentStatus(invoiceId, 'SUCCESS');
          await this.createSubscriptionFromPayment(invoiceId);
          return { status: 'SUCCESS', message: 'Payment successful and subscription created' };
        case 'FAILED':
          await this.updatePaymentStatus(invoiceId, 'FAILED', paymentStatus.invoice.failed_reason);
          return { status: 'FAILED', message: `Payment failed: ${paymentStatus.invoice.failed_reason}` };
        case 'PENDING':
        case 'PROCESSING':
          // Wait for 60 seconds before checking again
          await new Promise(resolve => setTimeout(resolve, 60000));
          return this.checkPaymentStatusRecursive(invoiceId, attempts + 1);
        default:
          await this.updatePaymentStatus(invoiceId, paymentStatus.invoice.state);
          return { status: paymentStatus.invoice.state, message: `Payment status: ${paymentStatus.invoice.state}` };
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      await this.updatePaymentStatus(invoiceId, 'FAILED', error instanceof Error ? error.message : 'Unknown error');
      return { status: 'FAILED', message: 'Payment failed due to an error' };
    }
  }

  private async updatePaymentStatus(invoiceId: string, status: string, errorMessage?: string) {
    await this.prisma.payment.update({
      where: { invoiceId },
      data: { 
        status,
        errorMessage: errorMessage || undefined
      },
    });
    console.log(`Payment status updated to: ${status}`);
  }

  private async createSubscriptionFromPayment(invoiceId: string) {
    try {
      const payment = await this.prisma.payment.findUnique({ where: { invoiceId } });
      if (!payment) throw new Error('Payment not found');

      const { planId, userId } = payment;

      await this.subscriptionService.createSubscription(userId, planId);

      console.log('Subscription created successfully.');
    } catch (error) {
      console.error('Error creating subscription from payment:', error);
      await this.updatePaymentStatus(invoiceId, 'FAILED', 'Failed to create subscription');
    }
  }
}