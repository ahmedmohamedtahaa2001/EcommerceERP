interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheStore {
  [key: string]: CacheEntry<any>;
}

const cache: CacheStore = {};

export interface CacheOptions {
  ttl: number; // Time to live in milliseconds
  key: string;
}

export class CacheManager {
  private static instance: CacheManager;

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  set<T>(key: string, data: T, ttl: number = 300000): void {
    cache[key] = {
      data,
      timestamp: Date.now(),
      ttl,
    };
  }

  get<T>(key: string): T | null {
    const entry = cache[key];

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      delete cache[key];
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = cache[key];

    if (!entry) {
      return false;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      delete cache[key];
      return false;
    }

    return true;
  }

  invalidate(key: string): void {
    delete cache[key];
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    Object.keys(cache).forEach(key => {
      if (regex.test(key)) {
        delete cache[key];
      }
    });
  }

  clear(): void {
    Object.keys(cache).forEach(key => {
      delete cache[key];
    });
  }

  getStats(): { keys: number; size: string } {
    const keys = Object.keys(cache).length;
    const size = JSON.stringify(cache).length;
    return {
      keys,
      size: `${(size / 1024).toFixed(2)} KB`,
    };
  }
}

export const cacheManager = CacheManager.getInstance();

export const cacheStrategies = {
  // Dashboard data - 5 minutes
  dashboard: {
    ttl: 5 * 60 * 1000,
    key: (userId: string) => `dashboard:${userId}`,
  },

  // Product list - 10 minutes
  products: {
    ttl: 10 * 60 * 1000,
    key: (page: number, limit: number) => `products:${page}:${limit}`,
  },

  // Analytics - 15 minutes
  analytics: {
    ttl: 15 * 60 * 1000,
    key: (userId: string) => `analytics:${userId}`,
  },

  // User data - 5 minutes (more frequent updates)
  user: {
    ttl: 5 * 60 * 1000,
    key: (userId: string) => `user:${userId}`,
  },

  // Customer list - 10 minutes
  customers: {
    ttl: 10 * 60 * 1000,
    key: (page: number, limit: number) => `customers:${page}:${limit}`,
  },

  // Orders - 5 minutes (frequently changing)
  orders: {
    ttl: 5 * 60 * 1000,
    key: (page: number, limit: number) => `orders:${page}:${limit}`,
  },

  // Inventory - 10 minutes
  inventory: {
    ttl: 10 * 60 * 1000,
    key: (page: number, limit: number) => `inventory:${page}:${limit}`,
  },
};

export async function withCache<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // Check cache first
  const cached = cacheManager.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch data
  const data = await fetcher();

  // Store in cache
  cacheManager.set(key, data, ttl);

  return data;
}

// Auto-cleanup old cache entries (run periodically)
export function startCacheCleanup(interval: number = 60000): NodeJS.Timer {
  return setInterval(() => {
    const now = Date.now();
    let cleaned = 0;

    Object.keys(cache).forEach(key => {
      const entry = cache[key];
      if (now - entry.timestamp > entry.ttl) {
        delete cache[key];
        cleaned++;
      }
    });

    if (cleaned > 0) {
      console.log(`[Cache Cleanup] Removed ${cleaned} expired entries`);
    }
  }, interval);
}

// Start cleanup on module load (if needed)
if (typeof global !== 'undefined' && !('__cacheCleanupStarted' in global)) {
  startCacheCleanup();
  (global as any).__cacheCleanupStarted = true;
}
