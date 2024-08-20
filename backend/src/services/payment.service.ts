// payment.service.ts
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

      // Initiate payment using Intasend SDK
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

      // Redirect user to the payment URL to complete payment
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

  async createSubscriptionFromPayment(planId: string, userId: string, paymentId: string) {
    try {
      const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new Error('Payment not found');
  
      let paymentStatus;
      try {
        paymentStatus = await this.intasend.collection().status(payment.invoiceId);
        console.log(`Status Resp:`, paymentStatus);
      } catch (error) {
        console.error(`Status Resp error:`, error);
        throw new Error('Failed to get payment status');
      }
  
      if (paymentStatus.invoice.state === 'COMPLETE') {
        await this.subscriptionService.createSubscription(userId, planId);
  
        // Update the payment status in the database
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: { status: 'SUCCESS' },
        });
  
        return { message: 'Subscription created successfully' };
      } else {
        // Update the payment status in the database
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: { status: paymentStatus.invoice.state },
        });
  
        return { message: `Payment status: ${paymentStatus.invoice.state}` };
      }
    } catch (error) {
      console.error('Error creating subscription from payment:', error);
      throw new Error('Failed to create subscription from payment');
    }
  }
}