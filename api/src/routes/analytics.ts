import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { prisma } from '../db';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/analytics/events — ingest a batch of events (authenticated users only)
router.post('/events', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events must be a non-empty array' });
    }

    if (events.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 events per batch' });
    }

    const userId = req.userId ?? null;

    const records = events
      .filter(e =>
        e &&
        typeof e.sessionId === 'string' && e.sessionId.length > 0 &&
        typeof e.eventType === 'string' && e.eventType.length > 0 &&
        typeof e.eventName === 'string' && e.eventName.length > 0
      )
      .map(e => ({
        id: randomUUID(),
        userId,
        sessionId: String(e.sessionId).slice(0, 128),
        eventType: String(e.eventType).slice(0, 64),
        eventName: String(e.eventName).slice(0, 128),
        properties: e.properties && typeof e.properties === 'object' ? e.properties : null,
        createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
      }));

    if (records.length > 0) {
      await prisma.analyticsEvent.createMany({ data: records });
    }

    res.json({ accepted: records.length });
  } catch (error) {
    console.error('Analytics ingest error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/analytics/admin/summary?days=30 — aggregate summary for admins
router.get('/admin/summary', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const days = Math.min(Math.max(parseInt(String(req.query.days)) || 30, 1), 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalEvents,
      uniqueUserRows,
      featureRows,
      pageViewRows,
      errorRows,
      userSummaryRows,
      eventsByDayRows,
    ] = await Promise.all([
      // Total events in period
      prisma.analyticsEvent.count({ where: { createdAt: { gte: since } } }),

      // Unique users in period
      prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: since }, userId: { not: null } },
        select: { userId: true },
        distinct: ['userId'],
      }),

      // Feature usage (non-page_view, non-session events)
      prisma.analyticsEvent.groupBy({
        by: ['eventName'],
        where: {
          createdAt: { gte: since },
          eventType: { notIn: ['page_view', 'session'] },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      }),

      // Page views breakdown
      prisma.analyticsEvent.groupBy({
        by: ['eventName'],
        where: { createdAt: { gte: since }, eventType: 'page_view' },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      // Errors
      prisma.analyticsEvent.groupBy({
        by: ['eventName'],
        where: { createdAt: { gte: since }, eventType: 'error' },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      // Per-user summary: sessionCount, eventCount, lastSeen
      prisma.$queryRaw<Array<{
        userId: string;
        email: string;
        name: string;
        sessionCount: bigint;
        eventCount: bigint;
        lastSeen: Date;
      }>>`
        SELECT
          ae."userId",
          u.email,
          u.name,
          COUNT(DISTINCT ae."sessionId") AS "sessionCount",
          COUNT(ae.id)                   AS "eventCount",
          MAX(ae."createdAt")            AS "lastSeen"
        FROM analytics_events ae
        JOIN users u ON u.id = ae."userId"
        WHERE ae."createdAt" >= ${since}
          AND ae."userId" IS NOT NULL
        GROUP BY ae."userId", u.email, u.name
        ORDER BY "lastSeen" DESC
      `,

      // Events by day
      prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT
          DATE_TRUNC('day', "createdAt") AS day,
          COUNT(*) AS count
        FROM analytics_events
        WHERE "createdAt" >= ${since}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY day ASC
      `,
    ]);

    res.json({
      days,
      totalEvents,
      uniqueUsers: uniqueUserRows.length,
      topFeatures: featureRows.map((r: { eventName: string; _count: { id: number } }) => ({ name: r.eventName, count: r._count.id })),
      pageViews: pageViewRows.map((r: { eventName: string; _count: { id: number } }) => ({ page: r.eventName, count: r._count.id })),
      errors: errorRows.map((r: { eventName: string; _count: { id: number } }) => ({ name: r.eventName, count: r._count.id })),
      userSummary: userSummaryRows.map((r: { userId: string; email: string; name: string; sessionCount: bigint; eventCount: bigint; lastSeen: Date }) => ({
        userId: r.userId,
        email: r.email,
        name: r.name,
        sessionCount: Number(r.sessionCount),
        eventCount: Number(r.eventCount),
        lastSeen: r.lastSeen,
      })),
      eventsByDay: eventsByDayRows.map((r: { day: Date; count: bigint }) => ({
        date: r.day,
        count: Number(r.count),
      })),
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
