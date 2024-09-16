import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      networkInfo?: {
        ipAddress: string;
        macAddress: string;
      };
    }
  }
}
