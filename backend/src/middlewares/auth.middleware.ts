// src/middleware/authMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.utils';
import AuthService  from '../services/auth.service';

interface UserPayload {
  userId: string;
  email: string;
  isAdmin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    try {
      const user = verifyToken(token) as UserPayload;
      req.user = user;
      next();
    } catch (error) {
      return res.status(403).json({ error: 'Invalid token' });
    }
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.isAdmin === true) {
    next();
  } else {
    res.status(403).json({ error: 'Insufficient permissions' });
  }
}

export const isCurrentUser = (req: Request, res: Response, next: NextFunction) => {
  const requestedUserId = req.params.userId;
  
  if (req.user && req.user.userId === requestedUserId) {
    next();
  } else {
    res.status(403).json({ error: 'Access denied' });
  }
};
