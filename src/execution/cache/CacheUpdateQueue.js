import Logger from '../../Logger';
import Notifier from '../Notifier';

export default class CacheUpdateQueue {
  constructor(globalCache) {
    this.globalCache = globalCache;
    this.queue = [];
    this.processing = false;
  }

  async enqueue(entities, source) {
    return new Promise((resolve) => {
      this.queue.push({ entities, source, resolve });
      Logger.debug(() => `Enqueued update from ${source.operationName}. Queue length: ${this.queue.length}`);
      
      if (!this.processing) {
        // Don't await - process queue in background
        this.processQueue();
      }
    });
  }

  async processQueue() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      const { entities, source, resolve } = this.queue.shift();
      
      try {
        await this.processUpdate(entities, source, resolve);
      } catch (error) {
        Logger.warn(() => `Error processing update from ${source.operationName}: ${error.message}`);
        resolve([]); // Resolve with empty updates on error
      }
    }
    
    this.processing = false;
  }

  async processUpdate(entities, source, resolve) {
    Logger.info(() => `Processing ${entities.length} entities from ${source.operationName}`);
    
    // Use the existing GlobalCache update method
    const updates = this.globalCache.update(entities);
    
    // Use the existing Notifier to maintain compatibility
    if (updates.length > 0) {
      Notifier.notify(updates);
      Logger.info(() => `Notified ${updates.length} entity updates from ${source.operationName}`);
    }
    
    // Resolve the promise so the caller knows the update is complete
    resolve(updates);
  }
}