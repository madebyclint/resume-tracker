import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// All routes require authentication + admin
router.use(requireAuth, requireAdmin);

// GET /api/admin/users — list all users
router.get('/', async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, isAdmin: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ users });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/users — create a new user
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { email, name, password, isAdmin = false } = req.body;

    if (!email || !name || !password) {
      return res.status(400).json({ error: 'email, name, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existing) {
      return res.status(409).json({ error: 'A user with that email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase().trim(), name, passwordHash, isAdmin },
      select: { id: true, email: true, name: true, isAdmin: true, createdAt: true },
    });

    res.status(201).json({ user });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/users/:id — update user fields (name, email, isAdmin, password)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, isAdmin, password } = req.body;

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = (email as string).toLowerCase().trim();
    if (isAdmin !== undefined) data.isAdmin = isAdmin;
    if (password) {
      if ((password as string).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      data.passwordHash = await bcrypt.hash(password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, isAdmin: true, createdAt: true },
    });
    res.json({ user });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(404).json({ error: 'User not found' });
  }
});

// DELETE /api/admin/users/:id — delete a user
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (id === req.userId) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(404).json({ error: 'User not found' });
  }
});

export default router;
