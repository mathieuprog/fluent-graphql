import { toSortedObject } from 'object-array-utils';
import Notifier from './Notifier';
import Query from './Query';
import QueryCache from './cache/QueryCache';

export default class QueryRegistry {
  constructor(document, executeRequest) {
    this.document = document;
    this.executeRequest = executeRequest;
    this.registry = {};
    this.onAllQueriesDestroyed = null;
  }

  getOrCreate(variables) {
    const key = JSON.stringify(toSortedObject(variables));

    if (this.registry[key]) {
      return this.registry[key];
    }

    const destroyIdleAfterDuration =
      (typeof this.document.destroyIdleAfterDuration === 'function')
        ? this.document.destroyIdleAfterDuration(variables)
        : this.document.destroyIdleAfterDuration;

    const pollAfterDuration =
      (typeof this.document.pollAfterDuration === 'function')
        ? this.document.pollAfterDuration(variables)
        : this.document.pollAfterDuration;

    const fetchAndUpdateCaches = (options) =>
      this.executeRequest(variables, Notifier.notify, options);

    const query = new Query(
      this.document,
      variables,
      (data) => new QueryCache(this.document, data, variables),
      fetchAndUpdateCaches,
      () => this.unregisterQuery(variables),
      destroyIdleAfterDuration,
      pollAfterDuration
    );

    this.registry[key] = query;

    return query;
  }

  get(variables) {
    return this.registry[JSON.stringify(toSortedObject(variables))] || null;
  }

  has(variables) {
    return !!this.registry[JSON.stringify(toSortedObject(variables))];
  }

  invalidateQueryCaches() {
    Object.values(this.registry).forEach((query) => query.invalidate());
  }

  destroyAll() {
    Object.values(this.registry).forEach((query) => query.destroy());
  }

  destroyAllWhenIdle(onAllQueriesDestroyed) {
    this.onAllQueriesDestroyed = onAllQueriesDestroyed;
    Object.values(this.registry).forEach((query) => query.destroyWhenIdle());
  }

  unregisterQuery(variables) {
    delete this.registry[JSON.stringify(toSortedObject(variables))];

    if (this.onAllQueriesDestroyed && Object.keys(this.registry).length === 0) {
      const callback = this.onAllQueriesDestroyed;
      this.onAllQueriesDestroyed = null;
      callback();
    }
  }
}
