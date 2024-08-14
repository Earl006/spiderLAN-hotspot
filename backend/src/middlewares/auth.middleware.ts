// src/middleware/authMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import AuthService from '../services/auth.service';
import { verifyToken } from '../utils/jwt.utils';

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

const authService = new AuthService();

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

export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  console.log('req.user:', req.user);

  if (req.user) {
    try {
      const user = await authService.getUserById(req.user.userId); // Use instance method
      if (user && user.isAdmin) {
        next();
      } else {
        res.status(403).json({ error: 'Access denied' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

export const isCurrentUser = (req: Request, res: Response, next: NextFunction) => {
  const requestedUserId = req.params.userId;
  
  if (req.user && req.user.userId === requestedUserId) {
    next();
  } else {
    res.status(403).json({ error: 'Access denied' });
  }
};
