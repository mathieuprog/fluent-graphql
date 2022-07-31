import { hasObjectProperty } from 'object-array-utils';
import Document from '../document/Document';
import OperationType from '../document/OperationType';
import QueryForVars from './QueryForVars';
import Notifier from './Notifier';
import transform from './transform';
import deriveFrom from './deriveFrom';
import deriveFromForeignKey from './deriveFromForeignKey';
import normalizeEntities from './normalizeEntities';
import AutoUnsubscriber from './AutoUnsubscriber';
import FetchStrategy from './FetchStrategy';
import { checkInstanceOfDocumentArg } from './helpers';

export default class OperationExecutor {
  constructor(document, client) {
    checkInstanceOfDocumentArg(document);
    this.document = document;
    this.maybeClient = client;
    this.queriesForVars = {};
  }

  unsubscribeOnSubsequentCalls() {
    return new AutoUnsubscriber(this);
  }

  async execute(...args) {
    const [variables, arg2, arg3, arg4] = args;

    switch (this.document.operationType) {
      case OperationType.QUERY:
        let subscriber;
        let returnUnsubscriber;
        let options;

        if (typeof arg2 === 'function') {
          subscriber = arg2;
          returnUnsubscriber = arg3;
          options = this.validateExecuteOptions(arg4);
        } else {
          options = this.validateExecuteOptions(arg2);
        }

        const fetchStrategy = options?.fetchStrategy || FetchStrategy.FETCH_FROM_CACHE_OR_FALLBACK_NETWORK;

        if (fetchStrategy === FetchStrategy.FETCH_FROM_NETWORK && !this.hasQueryForVars(variables)) {
          return this.document.transform(await this.executeRequest(variables));
        }

        const queryForVars = this.getQueryForVars(variables);

        if (subscriber) {
          const unsubscribe = queryForVars.subscribe(subscriber);
          returnUnsubscriber(unsubscribe);
        }

        await queryForVars.fetchByStrategy(fetchStrategy);

        queryForVars.listen(() => Notifier.subscribe(queryForVars));

        return queryForVars.cache.transformedData;

      case OperationType.MUTATION:
        return this.document.transform(await this.executeRequest(variables, Notifier.notify));

      case OperationType.SUBSCRIPTION: {
        const sink = arg2;
        const options = this.validateExecuteOptions(arg3);

        const client = await this.getClient();
        await client.subscribe(this.document.getQueryString(), variables, sink, options || {});
      } return;
    }
  }

  simulateNetworkRequest(data) {
    data = transform(this.document, data);
    const entities = normalizeEntities(this.document, data);
    Notifier.notify(entities);
  }

  async executeRequest(variables, handleUpdates) {
    await this.maybeSimulateNetworkDelay();

    const client = await this.getClient();

    const queryString = this.document.getQueryString();

    let data = {};

    if (queryString) {
      data = await client.request(this.document.getQueryString(), variables);
    }

    data = transform(this.document, data);

    data = await deriveFromForeignKey(this.document, data);

    data = await deriveFrom(this.document, data, variables);

    const entities = normalizeEntities(this.document, data);

    handleUpdates && handleUpdates(entities);

    return data;
  }

  async maybeSimulateNetworkDelay() {
    const delay = await this.document.maybeSimulateNetworkDelay();
    if (delay === false) {
      await Document.maybeSimulateNetworkDelayGlobally();
    }
  }

  getQueryForVars(variables) {
    const stringifiedVars = JSON.stringify(variables);

    if (!this.queriesForVars[stringifiedVars]) {
      this.queriesForVars[stringifiedVars] =
        new QueryForVars(
          this.document,
          variables,
          () => this.executeRequest(variables, Notifier.notify),
          () => this.removeQueryForVars(variables)
        );
    }

    return this.queriesForVars[stringifiedVars];
  }

  hasQueryForVars(variables) {
    return !!this.queriesForVars[JSON.stringify(variables)];
  }

  removeQueryForVars(variables) {
    const stringifiedVars = JSON.stringify(variables);
    delete this.queriesForVars[stringifiedVars];
  }

  getCache(variables) {
    const stringifiedVars = JSON.stringify(variables);
    return this.queriesForVars[stringifiedVars]?.cache?.transformedData || null;
  }

  validateExecuteOptions(options = {}) {
    if (!hasObjectProperty(options, 'fetchStrategy')) {
      return options;
    }

    switch (options.fetchStrategy) {
      case FetchStrategy.FETCH_FROM_CACHE_AND_NETWORK:
      case FetchStrategy.FETCH_FROM_CACHE_OR_FALLBACK_NETWORK:
      case FetchStrategy.FETCH_FROM_CACHE_OR_THROW:
      case FetchStrategy.FETCH_FROM_NETWORK:
        break;
      default:
        throw new Error();
    }

    return options;
  }

  getClient() {
    const client = this.maybeClient ?? Document.defaultClient;
    return (typeof client === 'function') ? client() : client;
  }
}
