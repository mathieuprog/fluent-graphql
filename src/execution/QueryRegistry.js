import { toSortedObject } from 'object-array-utils';
import Notifier from './Notifier';
import Query from './Query';
import QueryCache from './cache/QueryCache';

export default class QueryRegistry {
  constructor(document, executeRequest) {
    this.document = document;
    this.executeRequest = executeRequest;
    this.registry = {};
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

  // Helper that evaluates whether a query matches the `where` option.
  // `where` can be:
  //   1. A function: (variables, query) => boolean
  //   2. A plain object that should be a subset of the query variables. All
  //      key/value pairs must match strictly.
  //   3. Undefined / null – in that case every query matches.
  matchesWhere(where, query) {
    if (!where) {
      return true;
    }

    if (typeof where === 'function') {
      return !!where(query.variables, query);
    }

    if (typeof where === 'object') {
      return Object.entries(where).every(([key, value]) => query.variables[key] === value);
    }

    throw new Error('`where` option must be a function or an object');
  }

  invalidateQueryCaches(options = {}) {
    const { where } = options;


    Object.values(this.registry).forEach((query) => {
      if (this.matchesWhere(where, query)) {
        query.invalidate();
      }
    });
  }

  destroyAllWhenIdle(options = {}) {
    const { where } = options;

    Object.values(this.registry).forEach((query) => {
      if (!this.matchesWhere(where, query)) {
        return;
      }

      if (where) {
        // Condition-based destruction – re-evaluate the predicate right before
        // destroying to ensure it is still valid.
        query.destroyWhenIdle(() => this.matchesWhere(where, query));
      } else {
        query.destroyWhenIdle();
      }
    });
  }

  destroyAll() {
    Object.values(this.registry).forEach((query) => query.destroy());
  }

  unregisterQuery(variables) {
    delete this.registry[JSON.stringify(toSortedObject(variables))];
  }
}
