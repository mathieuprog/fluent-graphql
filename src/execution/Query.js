import { differenceArraysOfPrimitives, hasProperties, isArraySubset, omitProperties } from 'object-array-utils';
import Logger from '../Logger';
import DocumentOptions from '../document/DocumentOptions';
import FetchStrategy from './FetchStrategy';
import Notifier from './Notifier';

export default class Query {
  constructor(document, variables, createQueryCache, executeRequest, onCleared, clearAfterDuration, pollAfterDuration) {
    this.document = document;
    this.variables = variables;
    this.tenants = document.getTenantsCallback?.(variables);
    this.createQueryCache = createQueryCache;
    this.executeRequest = executeRequest;
    this.onCleared = onCleared;
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

  invalidateCache() {
    this.cache?.invalidate();
  }

  updateCache(updates) {
    if (this.cleared) {
      throw new Error();
    }

    const filteredUpdates = updates.filter(({ entity }) => {
      if (!this.document.possibleTypenames.includes(entity.__typename)) {
        return false;
      }

      if (this.tenants) {
        const tenantNames = DocumentOptions.getTenantsByTypename(entity.__typename);

        if (!isArraySubset(Object.keys(this.tenants), tenantNames)) {
          const missingTenants = differenceArraysOfPrimitives(tenantNames, Object.keys(this.tenants));
          throw new Error(`specify how to retrieve tenant fields [${missingTenants.join(', ')}] required for scoping entity "${entity.__typename}" (fetched from document "${entity.__meta.operationName}") through \`getTenants(fun)\` in "${this.document.operationName}" document.`);
        }

        if (!hasProperties(entity, tenantNames)) {
          throw new Error(`entity "${entity.__typename}" requires tenant fields: "${tenantNames.join(', ')}". Entity was fetched from document "${entity.__meta.operationName}" and a query cache from document "${this.document.operationName}" was updating. Entity: ${JSON.stringify(omitProperties(entity, ['__meta']), null, 2)}`);
        }

        const isOutsideTenantsScope =
          tenantNames.some((tenantName) => this.tenants[tenantName] !== entity[tenantName]);

        if (isOutsideTenantsScope) {
          return false;
        }
      }

      return this.document.filterEntityCallback(entity, this.variables);
    });

    const updated = this.cache.update(filteredUpdates);

    if (updated) {
      this.notifySubscribers(this.cache.getData());
    }

    if (updated && this.subscribers.size > 0) {
      this.timeoutClear = this.initTimeoutClear();
    }
  }

  async fetch(fetchStrategy) {
    fetchStrategy = fetchStrategy ?? DocumentOptions.defaultFetchStrategy;

    if (fetchStrategy === FetchStrategy.FetchFromNetworkAndSkipCaching) {
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

    const createCache = (data) => {
      this.cache = this.createQueryCache(data);
    };

    const notCachedOrInvalidated = () => {
      return !this.getCachedData() || this.cache.invalidated;
    };

    const fetchAndMaybeCache = async () => {
      const data = await fetch();
      // after the await, cache may already exist if 2 queries were executed simultaneously
      if (notCachedOrInvalidated()) {
        Logger.debug('Caching data...');
        createCache(data);
      }
    };

    const reasonCacheMiss = () => {
      if (!this.getCachedData()) {
        return '';
      }

      if (this.cache.invalidated) {
        return ' (invalidated)';
      }

      throw new Error();
    }

    switch (fetchStrategy) {
      default:
        throw new Error(`unknown or unexpected fetch strategy "${fetchStrategy}"`);

      case FetchStrategy.FetchFromCacheOrFallbackNetwork: {
        if (notCachedOrInvalidated()) {
          Logger.debug(`Cache miss${reasonCacheMiss()}, fetching from network...`);
          await fetchAndMaybeCache();
        } else {
          Logger.debug('Cache hit, using cached data.');
        }
      } break;

      case FetchStrategy.FetchFromCacheAndNetwork: {
        if (notCachedOrInvalidated()) {
          Logger.debug(`Cache miss${reasonCacheMiss()}, fetching from network...`);
          await fetchAndMaybeCache();
        } else {
          Logger.debug('Cache hit, using cached data and refreshing from network...');
          fetch();
        }
      } break;

      case FetchStrategy.FetchFromNetwork: {
        Logger.debug('Fetching from network...');
        await fetchAndMaybeCache();
      } break;

      case FetchStrategy.FetchFromNetworkAndRecreateCache: {
        Logger.debug('Fetching from network and recreating cache...');
        createCache(await fetch());
      } break;

      case FetchStrategy.FetchFromCacheOrThrow: {
        if (notCachedOrInvalidated()) {
          Logger.debug('Cache miss, throwing error...');
          throw new NotFoundInCacheError('not found in cache');
        } else {
          Logger.debug('Cache hit, using cached data.');
        }
      } break;
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
      // throw new Error('Cannot clear query that has active subscribers');
      Logger.warn(() => `Cannot clear ${this.document.operationName} query with vars ${JSON.stringify(this.variables, null, 2)} because it has active subscribers`);
      return;
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

    this.onCleared();
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
