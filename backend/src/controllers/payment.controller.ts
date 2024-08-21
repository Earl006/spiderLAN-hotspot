import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';

export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  async initiatePayment(req: Request, res: Response): Promise<Response> {
    const { planId, userId, phoneNumber } = req.body;

    try {
      const { paymentResponse, message, paymentId } = await this.paymentService.initiatePayment(
        planId,
        userId,
        phoneNumber
      );
      return res.status(200).json({ paymentResponse, message, paymentId });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }
}
