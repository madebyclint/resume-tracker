import { Router } from 'express';
import { prisma } from '../server';

const router = Router();

// GET /api/scraper-cache - Get cached scraper results
router.get('/', async (req, res) => {
  try {
    const { inputHash, limit = 100 } = req.query;
    
    const where: any = {};
    
    // Filter by input hash if provided
    if (inputHash) {
      where.inputHash = inputHash as string;
    }
    
    // Only return non-expired cache entries
    where.expiresAt = {
      gt: new Date()
    };
    
    const cacheEntries = await prisma.scraperCache.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string)
    });
    
    res.json(cacheEntries);
  } catch (error) {
    console.error('Error fetching scraper cache:', error);
    res.status(500).json({ error: 'Failed to fetch scraper cache' });
  }
});

// GET /api/scraper-cache/:inputHash - Get specific cached result
router.get('/:inputHash', async (req, res) => {
  try {
    const { inputHash } = req.params;
    
    const cacheEntry = await prisma.scraperCache.findUnique({
      where: { 
        inputHash,
        expiresAt: {
          gt: new Date() // Only return if not expired
        }
      }
    });
    
    if (!cacheEntry) {
      return res.status(404).json({ error: 'Cache entry not found or expired' });
    }
    
    res.json(cacheEntry);
  } catch (error) {
    console.error('Error fetching cache entry:', error);
    res.status(500).json({ error: 'Failed to fetch cache entry' });
  }
});

// POST /api/scraper-cache - Create new cache entry
router.post('/', async (req, res) => {
  try {
    const { inputHash, result, expiresAt } = req.body;
    
    // Validation
    if (!inputHash || !result) {
      return res.status(400).json({ 
        error: 'Missing required fields: inputHash and result' 
      });
    }
    
    // Set default expiration (7 days from now) if not provided
    const defaultExpiresAt = new Date();
    defaultExpiresAt.setDate(defaultExpiresAt.getDate() + 7);
    
    const cacheEntry = await prisma.scraperCache.upsert({
      where: { inputHash },
      update: {
        result,
        expiresAt: expiresAt ? new Date(expiresAt) : defaultExpiresAt
      },
      create: {
        inputHash,
        result,
        expiresAt: expiresAt ? new Date(expiresAt) : defaultExpiresAt
      }
    });
    
    res.status(201).json(cacheEntry);
  } catch (error) {
    console.error('Error creating cache entry:', error);
    res.status(500).json({ error: 'Failed to create cache entry' });
  }
});

// DELETE /api/scraper-cache/:inputHash - Delete specific cache entry
router.delete('/:inputHash', async (req, res) => {
  try {
    const { inputHash } = req.params;
    
    await prisma.scraperCache.delete({
      where: { inputHash }
    });
    
    res.json({ message: 'Cache entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting cache entry:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Cache entry not found' });
    }
    res.status(500).json({ error: 'Failed to delete cache entry' });
  }
});

// DELETE /api/scraper-cache/cleanup/expired - Clean up expired cache entries
router.delete('/cleanup/expired', async (req, res) => {
  try {
    const result = await prisma.scraperCache.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
    
    res.json({ 
      message: `Cleaned up ${result.count} expired cache entries`
    });
  } catch (error) {
    console.error('Error cleaning up cache:', error);
    res.status(500).json({ error: 'Failed to clean up cache' });
  }
});

// GET /api/scraper-cache/stats/summary - Get cache statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const [total, active, expired] = await Promise.all([
      prisma.scraperCache.count(),
      prisma.scraperCache.count({
        where: {
          expiresAt: {
            gt: new Date()
          }
        }
      }),
      prisma.scraperCache.count({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      })
    ]);
    
    res.json({
      total,
      active,
      expired
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ error: 'Failed to get cache statistics' });
  }
});

export default router;