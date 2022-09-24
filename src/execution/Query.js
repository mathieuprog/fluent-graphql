import FetchStrategy from './FetchStrategy';
import Notifier from './Notifier';

export default class Query {
  constructor(cacheStrategy, executeRequest, onClear, clearAfterDuration, pollAfterDuration) {
    this.cacheStrategy = cacheStrategy;
    this.executeRequest = executeRequest;
    this.onClear = onClear;
    this.cleared = false;
    this.pendingPromise = null;
    this.unsubscriber = null;
    this.clearAfterDuration = clearAfterDuration;
    this.pollAfterDuration = pollAfterDuration;
    this.timeoutClear = this.initTimeoutClear();
    this.intervalPoll = this.initIntervalPoll();
  }

  getCachedData() {
    return this.cacheStrategy.getCachedData();
  }

  updateCache(freshEntities) {
    if (this.cleared) {
      throw new Error();
    }

    const updated = this.cacheStrategy.updateCache(freshEntities);

    if (updated && !this.cacheStrategy.isClearable()) {
      this.timeoutClear = this.initTimeoutClear();
    }
  }

  async fetch(args, fetchStrategy) {
    this.cacheStrategy.beforeFetch(args);

    if (fetchStrategy === undefined) {
      fetchStrategy = FetchStrategy.FETCH_FROM_CACHE_OR_FALLBACK_NETWORK;
    }

    await this.doFetch(fetchStrategy);

    if (!this.unsubscriber) {
      this.unsubscriber = Notifier.subscribe(this);
    }

    return this.cacheStrategy.cache.getData();
  }

  async doFetch(fetchStrategy) {
    this.timeoutClear = this.initTimeoutClear();

    const fetch = () => {
      this.intervalPoll = this.initIntervalPoll();
      return this.executePromiseOrWaitPending();
    };

    const createCache = (data) => {
      this.cacheStrategy.createCache(data);
    };

    const cached = !!this.cacheStrategy.getCachedData();

    switch (fetchStrategy) {
      default:
        throw new Error(`unknown strategy ${fetchStrategy}`);

      case FetchStrategy.FETCH_FROM_CACHE_OR_FALLBACK_NETWORK:
        if (!cached) {
          createCache(await fetch());
        }
        break;

      case FetchStrategy.FETCH_FROM_CACHE_AND_NETWORK:
        if (!cached) {
          createCache(await fetch());
        } else {
          fetch();
        }
        break;

      case FetchStrategy.FETCH_FROM_NETWORK:
        if (!cached) {
          createCache(await fetch());
        } else {
          await fetch();
        }
        break;

      case FetchStrategy.FETCH_FROM_CACHE_OR_THROW:
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

    this.cacheStrategy.clear();

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
        if (this.pendingPromise || !this.cacheStrategy.isClearable()) {
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
      () => this.doFetch(FetchStrategy.FETCH_FROM_NETWORK),
      this.pollAfterDuration.total({ unit: 'millisecond' })
    );
  }
}
