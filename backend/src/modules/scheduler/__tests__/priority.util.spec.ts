import {
  effortDensity,
  computePriority,
  comparePriority,
} from '../priority.util';
import { URGENCY_CAP, MAX_IMPORTANCE } from '../scheduler.constants';

describe('priority.util', () => {
  describe('effortDensity', () => {
    it('returns remaining / time when minutesUntilDeadline > 0', () => {
      expect(effortDensity(60, 120)).toBe(0.5);
      expect(effortDensity(120, 60)).toBe(2);
      expect(effortDensity(0, 100)).toBe(0);
    });

    it('returns Infinity when minutesUntilDeadline <= 0', () => {
      expect(effortDensity(60, 0)).toBe(Infinity);
      expect(effortDensity(60, -10)).toBe(Infinity);
      expect(effortDensity(0, 0)).toBe(Infinity);
    });
  });

  describe('computePriority', () => {
    const now = new Date('2025-01-15T12:00:00Z');

    it('computes correct breakdown for a normal task', () => {
      const task = {
        estimatedMinutes: 120,
        completedMinutes: 60,
        deadline: new Date('2025-01-15T14:00:00Z'), // 2 hours = 120 min from now
        importance: 3,
      };

      const result = computePriority(task, now);

      // remaining = 120 - 60 = 60
      expect(result.remainingMinutes).toBe(60);
      // minutesUntilDeadline = 120
      expect(result.minutesUntilDeadline).toBe(120);
      // effortDensity = 60 / 120 = 0.5
      expect(result.effortDensity).toBe(0.5);
      // urgency = clamp(0.5, 0, 2) = 0.5
      expect(result.urgency).toBe(0.5);
      // normalizedImportance = 3 / 5 = 0.6
      expect(result.normalizedImportance).toBe(0.6);
      // score = 0.6 * 0.5 + 0.4 * 0.6 = 0.3 + 0.24 = 0.54
      expect(result.score).toBeCloseTo(0.54);
      expect(result.overdue).toBe(false);
    });

    it('caps urgency at URGENCY_CAP when effort density exceeds it', () => {
      const task = {
        estimatedMinutes: 300,
        completedMinutes: 0,
        deadline: new Date('2025-01-15T13:00:00Z'), // 60 min from now
        importance: 5,
      };

      const result = computePriority(task, now);

      // effortDensity = 300 / 60 = 5 (unclamped)
      expect(result.effortDensity).toBe(5);
      // urgency is clamped to URGENCY_CAP = 2
      expect(result.urgency).toBe(URGENCY_CAP);
      expect(result.overdue).toBe(false);
    });

    it('handles overdue task (deadline <= now)', () => {
      const task = {
        estimatedMinutes: 100,
        completedMinutes: 20,
        deadline: new Date('2025-01-15T12:00:00Z'), // exactly now
        importance: 4,
      };

      const result = computePriority(task, now);

      expect(result.overdue).toBe(true);
      expect(result.effortDensity).toBe(Infinity);
      expect(result.urgency).toBe(URGENCY_CAP);
      expect(result.minutesUntilDeadline).toBe(0);
      expect(result.remainingMinutes).toBe(80);
    });

    it('handles past deadline (deadline < now)', () => {
      const task = {
        estimatedMinutes: 50,
        completedMinutes: 0,
        deadline: new Date('2025-01-15T11:00:00Z'), // 1 hour ago
        importance: 2,
      };

      const result = computePriority(task, now);

      expect(result.overdue).toBe(true);
      expect(result.effortDensity).toBe(Infinity);
      expect(result.urgency).toBe(URGENCY_CAP);
      expect(result.minutesUntilDeadline).toBe(-60);
    });

    it('clamps remainingMinutes to 0 when completed exceeds estimated', () => {
      const task = {
        estimatedMinutes: 30,
        completedMinutes: 50,
        deadline: new Date('2025-01-16T12:00:00Z'),
        importance: 1,
      };

      const result = computePriority(task, now);

      expect(result.remainingMinutes).toBe(0);
      expect(result.effortDensity).toBe(0);
      expect(result.urgency).toBe(0);
    });

    it('uses custom settings when provided', () => {
      const task = {
        estimatedMinutes: 100,
        completedMinutes: 0,
        deadline: new Date('2025-01-15T14:00:00Z'), // 120 min
        importance: 5,
      };

      const result = computePriority(task, now, {
        urgencyWeight: 0.3,
        importanceWeight: 0.7,
      });

      // effortDensity = 100/120 ≈ 0.833
      // urgency = clamp(0.833, 0, 2) = 0.833
      // normalizedImportance = 5/5 = 1.0
      // score = 0.3 * 0.833 + 0.7 * 1.0 ≈ 0.25 + 0.7 = 0.95
      expect(result.normalizedImportance).toBe(1.0);
      expect(result.score).toBeCloseTo(0.3 * (100 / 120) + 0.7 * 1.0);
    });

    it('uses default weights when settings is undefined', () => {
      const task = {
        estimatedMinutes: 60,
        completedMinutes: 0,
        deadline: new Date('2025-01-15T13:00:00Z'), // 60 min
        importance: 5,
      };

      const result = computePriority(task, now);

      // effortDensity = 60/60 = 1.0, urgency = 1.0
      // normalizedImportance = 1.0
      // score = 0.6*1.0 + 0.4*1.0 = 1.0
      expect(result.score).toBeCloseTo(1.0);
    });
  });

  describe('comparePriority', () => {
    const base = {
      score: 1.0,
      deadline: new Date('2025-01-20T12:00:00Z'),
      importance: 3,
      createdAt: new Date('2025-01-10T08:00:00Z'),
      id: 'aaa',
    };

    it('returns negative when a has higher score (a first)', () => {
      const a = { ...base, score: 1.5 };
      const b = { ...base, score: 1.0 };
      expect(comparePriority(a, b)).toBeLessThan(0);
    });

    it('returns positive when b has higher score (b first)', () => {
      const a = { ...base, score: 0.5 };
      const b = { ...base, score: 1.0 };
      expect(comparePriority(a, b)).toBeGreaterThan(0);
    });

    it('breaks tie by deadline asc (earlier deadline first)', () => {
      const a = { ...base, deadline: new Date('2025-01-18T12:00:00Z') };
      const b = { ...base, deadline: new Date('2025-01-20T12:00:00Z') };
      expect(comparePriority(a, b)).toBeLessThan(0);
    });

    it('breaks tie by importance desc (higher importance first)', () => {
      const a = { ...base, importance: 5 };
      const b = { ...base, importance: 3 };
      expect(comparePriority(a, b)).toBeLessThan(0);
    });

    it('breaks tie by createdAt asc (earlier created first)', () => {
      const a = { ...base, createdAt: new Date('2025-01-05T08:00:00Z') };
      const b = { ...base, createdAt: new Date('2025-01-10T08:00:00Z') };
      expect(comparePriority(a, b)).toBeLessThan(0);
    });

    it('breaks tie by id asc (lexicographically smaller first)', () => {
      const a = { ...base, id: 'aaa' };
      const b = { ...base, id: 'bbb' };
      expect(comparePriority(a, b)).toBeLessThan(0);
    });

    it('returns 0 for identical items', () => {
      expect(comparePriority(base, { ...base })).toBe(0);
    });
  });
});
