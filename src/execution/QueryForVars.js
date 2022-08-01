import QueryCache from './QueryCache';
import getFetchStrategyAlgorithm from './getFetchStrategyAlgorithm';
import FetchStrategy from './FetchStrategy';

export default class QueryForVars {
  constructor(document, variables, executeRequest, onClear) {
    this.document = document;
    this.variables = variables;
    this.executeRequest = executeRequest;
    this.onClear = onClear;
    this.cleared = false;
    this.pendingPromise = null;
    this.cache = null;
    this.unsubscriber = null;
    this.subscribers = new Set();
    this.solicitedAt = null;
    this.clearAfterDuration = null;
    this.pollAfterDuration = null;
    this.timeoutClear = this.initTimeoutClear();
    this.intervalPoll = this.initIntervalPoll();
  }

  clear() {
    if (this.subscribers.size > 0) {
      throw new Error('Cannot clear query that has active subscribers');
    }
    if (this.unsubscriber) {
      this.unsubscriber();
      this.unsubscriber = null;
    }
    clearTimeout(this.timeoutClear);
    clearInterval(this.intervalPoll);
    this.onClear && this.onClear();
    this.cleared = true;
  }

  subscribe(subscriber) {
    const item = { subscriber };
    this.subscribers.add(item);

    return () => {
      this.subscribers.delete(item);
    };
  }

  listen(subscribe) {
    if (!this.unsubscriber) {
      this.unsubscriber = subscribe();
    }
  }

  notifySubscribers(data) {
    for (const { subscriber } of this.subscribers) {
      subscriber(data);
    }

    if (this.subscribers.size > 0) {
      this.solicitedAt = new Date();
      this.timeoutClear = this.initTimeoutClear();
    }
  }

  updateCache(updates) {
    if (this.cleared) {
      throw new Error();
    }
    if (this.cache.update(updates)) {
      this.notifySubscribers(this.cache.transformedData);
    }
  }

  async fetchByStrategy(fetchStrategy) {
    this.solicitedAt = new Date();
    this.timeoutClear = this.initTimeoutClear();

    await getFetchStrategyAlgorithm(fetchStrategy)({
      fetchData: this.fetchData.bind(this),
      cacheData: this.cacheData.bind(this),
      cached: !!this.cache
    });
  }

  async fetchData() {
    this.intervalPoll = this.initIntervalPoll();

    return await this.executePromiseOrWaitPending(this.executeRequest);
  }

  cacheData(data) {
    if (!this.cache) {
      this.cache = new QueryCache(this.document, data, this.variables);
    }
  }

  async executePromiseOrWaitPending(getPromise) {
    let result;

    if (this.pendingPromise) {
      result = await this.pendingPromise;
    } else {
      const promise = getPromise();

      this.pendingPromise = promise;

      try {
        result = await promise;
      } finally {
        this.pendingPromise = null;
      }
    }

    return result;
  }

  initTimeoutClear() {
    if (!this.document.clearAfterDuration) {
      return null;
    }

    if (!this.clearAfterDuration) {
      this.clearAfterDuration =
        (typeof this.document.clearAfterDuration === 'function')
          ? this.document.clearAfterDuration(this.variables)
          : this.document.clearAfterDuration;
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
    if (!this.document.pollAfterDuration) {
      return null;
    }

    if (!this.pollAfterDuration) {
      this.pollAfterDuration =
        (typeof this.document.pollAfterDuration === 'function')
          ? this.document.pollAfterDuration(this.variables)
          : this.document.pollAfterDuration;
    }

    clearInterval(this.intervalPoll);

    return setInterval(
      () => this.fetchByStrategy(FetchStrategy.FETCH_FROM_NETWORK),
      this.pollAfterDuration.total({ unit: 'millisecond' })
    );
  }
}
