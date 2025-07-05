import { differenceArraysOfPrimitives, hasProperties, isArraySubset, omitProperties } from 'object-array-utils';
import Logger from '../Logger';
import DocumentOptions from '../document/DocumentOptions';
import NotFoundInCacheError from '../errors/NotFoundInCacheError';
import FetchStrategy from './FetchStrategy';
import Notifier from './Notifier';

export default class Query {
  constructor(document, variables, createQueryCache, runNetworkRequest, unregisterQuery, destroyIdleAfterDuration, pollAfterDuration) {
    this.document = document;
    this.variables = variables;
    this.tenants = document.getTenantsCallback?.(variables);
    this.createQueryCache = createQueryCache;
    this.runNetworkRequest = runNetworkRequest;
    this.unregisterQuery = unregisterQuery;
    this.pendingPromise = null;
    this.unsubscriber = null;
    this.pollAfterDuration = pollAfterDuration;
    this.destroyIdleAfterDuration = destroyIdleAfterDuration;
    this.intervalPoll = this.initIntervalPoll();
    this.timeoutDestroyIdle = this.initTimeoutDestroyIdle();
    this.cache = null;
    this.subscribers = new Set();
    this.shouldDestroyWhenIdle = false;
    this.isDestroyed = false;
  }

  getCachedData() {
    return this.cache?.getData() || null;
  }

  invalidate() {
    if (this.cache) {
      this.cache.markStale();
      // TODO notify observers of the isStale, isRefreshing, isFetching, etc. update
      // this.notify();
    }

    const shouldFetch =
      !this.cache || (this.subscribers.size > 0 && !this.pendingPromise);
  
    if (shouldFetch) {
      this.fetch(FetchStrategy.FetchFromNetwork);
    }
  }

  updateCache(updates) {
    if (!this.cache || this.isDestroyed) {
      return;
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
      this.initTimeoutDestroyIdle();
    }
  }

  async fetch(fetchStrategy) {
    if (this.isDestroyed) {
      throw new Error();
    }

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
    this.initTimeoutDestroyIdle();

    const fetch = () => {
      this.intervalPoll = this.initIntervalPoll();
      return this.executePromiseOrWaitPending();
    };

    const createCache = (data) => {
      this.cache = this.createQueryCache(data);
    };

    const fetchAndMaybeCache = async () => {
      const data = await fetch();
      // after the await, cache may already exist if 2 queries were executed simultaneously
      if (!this.cache) {
        Logger.debug('Caching data…');
        createCache(data);
      }
    };

    switch (fetchStrategy) {
      default:
        throw new Error(`unknown or unexpected fetch strategy "${fetchStrategy}"`);

      case FetchStrategy.FetchFromCacheOrFallbackNetwork: {
        if (!this.cache) {
          Logger.debug(`Cache miss, fetching from network…`);
          await fetchAndMaybeCache();
        } else {
          Logger.debug('Cache hit, using cached data.');
        }
      } break;

      case FetchStrategy.FetchFromCacheAndNetwork: {
        if (!this.cache) {
          Logger.debug(`Cache miss, fetching from network…`);
          await fetchAndMaybeCache();
        } else {
          Logger.debug('Cache hit, using cached data and refreshing from network…');
          fetch();
        }
      } break;

      case FetchStrategy.FetchFromNetwork: {
        Logger.debug('Fetching from network…');
        await fetchAndMaybeCache();
      } break;

      case FetchStrategy.FetchFromNetworkAndRecreateCache: {
        Logger.debug('Fetching from network and recreating cache…');
        createCache(await fetch());
      } break;

      case FetchStrategy.FetchFromCacheOrThrow: {
        if (!this.cache) {
          Logger.debug('Cache miss, throwing error…');
          throw new NotFoundInCacheError('not found in cache');
        } else {
          Logger.debug('Cache hit, using cached data.');
        }
      } break;
    }
  }

  // “single-flight” or “in-flight deduplication” pattern
  async executePromiseOrWaitPending() {
    if (this.isDestroyed) {
      throw new Error();
    }

    if (this.pendingPromise) {
      return this.pendingPromise;
    }

    const { dataPromise, abort } = this.runNetworkRequest();

    this.pendingPromise = (async () => {
      try {
        return await dataPromise;
      } finally {
        this.pendingPromise = null;
        if (this.shouldDestroyWhenIdle) {
          this.destroyIfIdle();
        }
      }
    })();

    this.pendingPromise.abort = (...args) => {
      abort?.(...args);
      this.pendingPromise = null;
    };

    return this.pendingPromise;
  }

  stopListening() {
    if (this.unsubscriber) {
      Logger.debug(() => `Unsubscribing ${this.document.operationName} query with vars ${JSON.stringify(this.variables, null, 2)} from data updates`);
      this.unsubscriber();
      this.unsubscriber = null;
    }
  }

  destroy() {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;
    this.shouldDestroyWhenIdle = false;
    this.pendingPromise?.abort?.();
    this.pendingPromise = null;
    this.notifySubscribers(null);
    this.subscribers.clear();
    this.stopListening();
    this.cache = null;
    clearTimeout(this.timeoutDestroyIdle);
    clearInterval(this.intervalPoll);
    this.unregisterQuery();
  }

  destroyWhenIdle() {
    this.shouldDestroyWhenIdle = true;
    this.destroyIfIdle();
  }

  destroyIfIdle() {
    if (this.pendingPromise || this.subscribers.size > 0) {
      return;
    }

    this.destroy();
  }

  initTimeoutDestroyIdle() {
    if (!this.destroyIdleAfterDuration) {
      return null;
    }
  
    clearTimeout(this.timeoutDestroyIdle);

    this.timeoutDestroyIdle = setTimeout(
      () => this.destroyIfIdle(),
      this.destroyIdleAfterDuration.total({ unit:'millisecond' })
    );
    return this.timeoutDestroyIdle;
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

    this.shouldDestroyWhenIdle = false;

    const item = { subscriber };
    this.subscribers.add(item);
    Logger.info(() => `Added a subscriber to ${this.document.operationName} query with vars ${JSON.stringify(this.variables, null, 2)}. Total subscriber count: ${this.subscribers.size}`);

    return () => {
      this.subscribers.delete(item);

      if (this.subscribers.size === 0 && this.shouldDestroyWhenIdle) {
        this.destroy();
      }

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
