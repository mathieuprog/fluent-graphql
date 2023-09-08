import { sortProperties } from 'object-array-utils';
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
    const key = JSON.stringify(sortProperties(variables));

    if (this.registry[key]) {
      return this.registry[key];
    }

    const clearAfterDuration =
      (typeof this.document.clearAfterDuration === 'function')
        ? this.document.clearAfterDuration(variables)
        : this.document.clearAfterDuration;

    const pollAfterDuration =
      (typeof this.document.pollAfterDuration === 'function')
        ? this.document.pollAfterDuration(variables)
        : this.document.pollAfterDuration;

    const query = new Query(
      this.document,
      variables,
      (data) => new QueryCache(this.document, data, variables),
      () => this.executeRequest(variables, Notifier.notify),
      () => this.handleQueryCleared(variables),
      clearAfterDuration,
      pollAfterDuration
    );

    this.registry[key] = query;

    return query;
  }

  get(variables) {
    return this.registry[JSON.stringify(sortProperties(variables))] || null;
  }

  has(variables) {
    return !!this.registry[JSON.stringify(sortProperties(variables))];
  }

  invalidateAllCaches() {
    Object.values(this.registry).forEach((query) => query.invalidateCache());
  }

  removeAll() {
    Object.values(this.registry).forEach((query) => query.clear());
  }

  handleQueryCleared(variables) {
    delete this.registry[JSON.stringify(sortProperties(variables))];
  }
}
