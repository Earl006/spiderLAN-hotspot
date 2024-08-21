import express from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { PaymentService } from '../services/payment.service';
import { PrismaClient } from '@prisma/client';
import SubscriptionService from '../services/subscription.service';

const router = express.Router();
const prismaClient = new PrismaClient();
const subscriptionService = new SubscriptionService(); // Ensure PrismaClient is passed to SubscriptionService
const paymentService = new PaymentService(prismaClient, subscriptionService);
const paymentController = new PaymentController(paymentService);

router.post('/initiate', paymentController.initiatePayment.bind(paymentController));

export default router;
