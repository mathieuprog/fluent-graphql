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
      () => this.remove(variables),
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

  removeAll() {
    Object.keys(this.registry).forEach(this.doRemove);
  }

  remove(variables) {
    this.doRemove(JSON.stringify(sortProperties(variables)));
  }

  doRemove(key) {
    if (this.registry[key]) {
      const query = this.registry[key];
      delete this.registry[key];

      query.clear();
    }
  }
}
