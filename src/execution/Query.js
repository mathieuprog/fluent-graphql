import Document from '../document/Document';
import FetchStrategy from './FetchStrategy';
import Notifier from './Notifier';
import Logger from '../Logger';

export default class Query {
  constructor(document, variables, createQueryCache, executeRequest, onClear, clearAfterDuration, pollAfterDuration) {
    this.document = document;
    this.variables = variables;
    this.createQueryCache = createQueryCache;
    this.executeRequest = executeRequest;
    this.onClear = onClear;
    this.cleared = false;
    this.pendingPromise = null;
    this.unsubscriber = null;
    this.clearAfterDuration = clearAfterDuration;
    this.pollAfterDuration = pollAfterDuration;
    this.timeoutClear = this.initTimeoutClear();
    this.intervalPoll = this.initIntervalPoll();
    this.cache = null;
    this.subscribers = new Set();
  }

  getCachedData() {
    return this.cache?.getData() || null;
  }

  updateCache(freshEntities) {
    if (this.cleared) {
      throw new Error();
    }

    const updated = this.cache.update(freshEntities);

    if (updated) {
      this.notifySubscribers(this.cache.getData());
    }

    if (updated && this.subscribers.size > 0) {
      this.timeoutClear = this.initTimeoutClear();
    }
  }

  async fetch(fetchStrategy) {
    fetchStrategy = fetchStrategy ?? Document.defaultFetchStrategy;

    if (fetchStrategy === FetchStrategy.FetchFromNetworkAndNoCache) {
      throw new Error();
    }

    await this.doFetch(fetchStrategy);

    if (!this.unsubscriber) {
      Logger.info(() => `Subscribing ${this.document.operationName} query with vars ${JSON.stringify(this.variables, null, 2)} for data updates`);
      this.unsubscriber = Notifier.subscribe(this);
    }

    return this.cache.getData();
  }

  async doFetch(fetchStrategy) {
    this.timeoutClear = this.initTimeoutClear();

    const fetch = () => {
      this.intervalPoll = this.initIntervalPoll();
      return this.executePromiseOrWaitPending();
    };

    switch (fetchStrategy) {
      default:
        throw new Error(`unknown or unexpected fetch strategy "${fetchStrategy}"`);

      case FetchStrategy.FetchFromCacheOrFallbackNetwork:
        if (!this.cached()) {
          Logger.debug('Cache miss, fetching from network...');
          this.createCacheIfNotExists(await fetch());
        } else {
          Logger.debug('Cache hit, using cached data.');
        }
        break;

      case FetchStrategy.FetchFromCacheAndNetwork:
        if (!this.cached()) {
          Logger.debug('Cache miss, fetching from network and caching data...');
          this.createCacheIfNotExists(await fetch());
        } else {
          Logger.debug('Cache hit, using cached data and refreshing from network...');
          fetch();
        }
        break;

      case FetchStrategy.FetchFromNetwork:
        if (!this.cached()) {
          Logger.debug('Cache miss, fetching from network and caching data...');
          this.createCacheIfNotExists(await fetch());
        } else {
          Logger.debug('Cache hit, fetching from network regardless...');
          await fetch();
        }
        break;

      case FetchStrategy.FetchFromNetworkAndRecreateCache:
        Logger.debug('Fetching from network and recreating cache...');
        this.createCache(await fetch());
        break;

      case FetchStrategy.FetchFromCacheOrThrow:
        if (!this.cached()) {
          Logger.debug('Cache miss, throwing error...');
          throw new NotFoundInCacheError('not found in cache');
        } else {
          Logger.debug('Cache hit, using cached data.');
        }
        break;
    }
  }

  createCacheIfNotExists(data) {
    // cache may already exist if 2 queries are executed simultaneously
    if (!this.cache) {
      this.createCache(data);
    }
  }

  createCache(data) {
    this.cache = this.createQueryCache(data);
  };

  cached() {
    return !!this.cache?.getData();
  }

  async executePromiseOrWaitPending() {
    let result;

    if (this.pendingPromise) {
      result = await this.pendingPromise;
    } else {
      const promise = this.executeRequest();

      this.pendingPromise = promise;

      try {
        result = await promise;
      } finally {
        this.pendingPromise = null;
      }
    }

    return result;
  }

  clear() {
    if (this.cleared) {
      return;
    }

    if (this.subscribers.size > 0) {
      throw new Error('Cannot clear query that has active subscribers');
    }

    Logger.info(() => `Clearing ${this.document.operationName} query with vars ${JSON.stringify(this.variables, null, 2)}`);

    if (this.unsubscriber) {
      Logger.debug(() => `Unsubscribing ${this.document.operationName} query with vars ${JSON.stringify(this.variables, null, 2)} from data updates`);

      this.unsubscriber();
      this.unsubscriber = null;
    }

    clearTimeout(this.timeoutClear);
    clearInterval(this.intervalPoll);

    this.cleared = true;

    this.onClear();
  }

  initTimeoutClear() {
    if (!this.clearAfterDuration) {
      return null;
    }

    clearTimeout(this.timeoutClear);

    return setTimeout(
      () => {
        if (this.pendingPromise || this.subscribers.size > 0) {
          this.timeoutClear = this.initTimeoutClear();
          return;
        }

        this.clear();
      },
      this.clearAfterDuration.total({ unit: 'millisecond' })
    );
  }

  initIntervalPoll() {
    if (!this.pollAfterDuration) {
      return null;
    }

    clearInterval(this.intervalPoll);

    return setInterval(
      () => this.fetch(FetchStrategy.FetchFromNetwork),
      this.pollAfterDuration.total({ unit: 'millisecond' })
    );
  }

  addSubscriber(subscriber) {
    if (typeof subscriber !== 'function') {
      throw new Error(`subscriber is not a function: ${JSON.stringify(subscriber)}`);
    }

    const item = { subscriber };
    this.subscribers.add(item);
    Logger.info(() => `Added a subscriber to ${this.document.operationName} query with vars ${JSON.stringify(this.variables, null, 2)}. Total subscriber count: ${this.subscribers.size}`);

    return () => {
      this.subscribers.delete(item);
      Logger.info(() => `Unsubscribed a subscriber to ${this.document.operationName} query with vars ${JSON.stringify(this.variables, null, 2)}. ${this.subscribers.size} subscribers left`);
    };
  }

  notifySubscribers(data) {
    Logger.info(() => `Notifying ${this.subscribers.size} subscribers to ${this.document.operationName} query with vars ${JSON.stringify(this.variables, null, 2)} with new data`);
    Logger.verbose(() => `New data: ${JSON.stringify(data, null, 2)}`);
    for (const { subscriber } of this.subscribers) {
      subscriber(data);
    }
  }
}
