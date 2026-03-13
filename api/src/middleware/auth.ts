import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  isAdmin?: boolean;
}

/**
 * Middleware that verifies the JWT token and attaches userId to the request.
 * Returns 401 if no token is provided or the token is invalid.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; isAdmin?: boolean };
    req.userId = payload.userId;
    req.userEmail = payload.email;
    req.isAdmin = payload.isAdmin ?? false;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

/**
 * Middleware that requires the authenticated user to be an admin.
 * Falls back to a DB lookup for tokens issued before isAdmin was added to the JWT.
 * Must be used after requireAuth.
 */
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.isAdmin) {
    return next();
  }
  // Old tokens won't have isAdmin in the payload — check the DB directly.
  if (!req.userId) {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { isAdmin: true },
    });
    if (user?.isAdmin) {
      req.isAdmin = true;
      return next();
    }
  } catch {
    // DB lookup failed; deny access
  }
  return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
}

export function generateToken(userId: string, email: string, isAdmin: boolean = false): string {
  return jwt.sign({ userId, email, isAdmin }, JWT_SECRET, { expiresIn: '30d' });
}
