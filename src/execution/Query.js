import FetchStrategy from './FetchStrategy';
import Notifier from './Notifier';

export default class Query {
  constructor(createQueryCache, executeRequest, onClear, clearAfterDuration, pollAfterDuration) {
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
    if (fetchStrategy === undefined) {
      fetchStrategy = FetchStrategy.FetchFromCacheOrFallbackNetwork;
    }

    await this.doFetch(fetchStrategy);

    if (!this.unsubscriber) {
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

    const cached = !!this.cache?.getData();

    const createCache = (data) => {
      if (this.cache) {
        throw new Error('cache already created');
      }
      this.cache = this.createQueryCache(data);
    };

    switch (fetchStrategy) {
      default:
        throw new Error(`unknown strategy ${fetchStrategy}`);

      case FetchStrategy.FetchFromCacheOrFallbackNetwork:
        if (!cached) {
          createCache(await fetch());
        }
        break;

      case FetchStrategy.FetchFromCacheAndNetwork:
        if (!cached) {
          createCache(await fetch());
        } else {
          fetch();
        }
        break;

      case FetchStrategy.FetchFromNetwork:
        if (!cached) {
          createCache(await fetch());
        } else {
          await fetch();
        }
        break;

      case FetchStrategy.FetchFromCacheOrThrow:
        if (!cached) {
          throw new NotFoundInCacheError('not found in cache');
        }
        break;
    }
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

    if (this.unsubscriber) {
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
      () => this.doFetch(FetchStrategy.FetchFromNetwork),
      this.pollAfterDuration.total({ unit: 'millisecond' })
    );
  }

  addSubscriber(subscriber) {
    if (typeof subscriber !== 'function') {
      throw new Error(`subscriber is not a function: ${JSON.stringify(subscriber)}`);
    }

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
