import QueryCache from '../QueryCache';

export default class DefaultCacheStrategy {
  constructor(document, variables) {
    this.document = document;
    this.variables = variables;
    this.cache = null;
    this.subscribers = new Set();
  }

  isClearable() {
    return this.subscribers.size === 0;
  }

  clear() {
    if (!this.isClearable()) {
      throw new Error('Cannot clear query that has active subscribers');
    }
  }

  beforeFetch(args) {
    if (typeof args[1] !== 'function') {
      return;
    }

    const [_variables, subscriber, returnUnsubscriber] = args;

    const unsubscribe = this.subscribe(subscriber);
    returnUnsubscriber(unsubscribe);
  }

  createCache(data) {
    if (this.cache) {
      throw new Error('cache already created');
    }

    this.cache = new QueryCache(this.document, data, this.variables);
  }

  getCachedData() {
    return this.cache?.getData() || null;
  }

  updateCache(freshEntities) {
    const updated = this.cache.update(freshEntities);

    if (updated) {
      this.notifySubscribers(this.cache.getData());
    }

    return updated;
  }

  subscribe(subscriber) {
    const item = { subscriber };
    this.subscribers.add(item);

    return () => {
      this.subscribers.delete(item);
    };
  }

  notifySubscribers(data) {
    for (const { subscriber } of this.subscribers) {
      subscriber(data);
    }
  }
}
