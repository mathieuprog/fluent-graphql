import CacheUpdateQueue from './cache/CacheUpdateQueue';
import globalCache from './globalCache';

// Singleton instance of the update queue
const updateQueue = new CacheUpdateQueue(globalCache);

export default updateQueue;