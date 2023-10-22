import Logger from '../Logger';
import DocumentOptions from '../document/DocumentOptions';
import OperationType from '../document/OperationType';
import FetchStrategy from './FetchStrategy';
import Notifier from './Notifier';
import QueryRegistry from './QueryRegistry';
import addVirtualScalars from './addVirtualScalars';
import deriveFrom from './deriveFrom';
import deriveFromReference from './deriveFromReference';
import globalCache from './globalCache';
import { throwIfNotInstanceOfDocument } from './helpers';
import normalizeEntities from './normalizeEntities';
import reference from './reference';
import transform from './transform';

export default class OperationExecutor {
  constructor(document, client) {
    throwIfNotInstanceOfDocument(document);
    this.document = document;
    this.maybeClient = client;
    this.queryRegistry =
      new QueryRegistry(
        document,
        this.executeRequest.bind(this));
  }

  clearQueries() {
    this.queryRegistry.removeAll();
  }

  invalidateAllCaches() {
    this.queryRegistry.invalidateAllCaches();
  }

  execute(...args) {
    switch (this.document.operationType) {
      case OperationType.Query:
        return this.executeQuery(args);

      case OperationType.Mutation:
        return this.executeMutation(args);

      case OperationType.Subscription:
        return this.executeSubscription(args);
    }
  }

  refetchQuery(variables) {
    if (this.document.operationType !== OperationType.Query) {
      throw new Error();
    }

    const fetchStrategy = this.document.getRefetchStrategy() ?? FetchStrategy.FetchFromNetwork;

    return this.executeQuery([variables, { fetchStrategy }]);
  }

  async executeQuery(args) {
    const [variables_, options] = args;
    const variables = variables_ || {};
    const fetchStrategy = options?.fetchStrategy || DocumentOptions.defaultFetchStrategy;

    Logger.info(() => `Executing (${FetchStrategy.toString(fetchStrategy)}) query ${this.document.operationName} with vars ${JSON.stringify(variables, null, 2)}`);

    if (fetchStrategy === FetchStrategy.FetchFromNetworkAndNoCache) {
      Logger.info('The query won\'t be cached');
      return await this.executeRequestAndUserCallbacks(variables, Notifier.notify);
    }

    if (fetchStrategy === FetchStrategy.FetchFromNetworkAndNoCacheNoCacheUpdates) {
      Logger.info('The query won\'t be cached, and cache updates will be skipped');
      return await this.executeRequestAndUserCallbacks(variables);
    }

    const query = this.queryRegistry.getOrCreate(variables);

    const transformedData = await query.fetch(fetchStrategy);
    Logger.verbose(() => `Return data for query ${this.document.operationName} with vars ${JSON.stringify(variables, null, 2)}: ${JSON.stringify(transformedData, null, 2)}`);
    this.document.afterExecutionCallback(transformedData);
    return transformedData;
  }

  executeMutation(args) {
    const [variables_] = args;
    const variables = variables_ || {};

    Logger.info(() => `Executing mutation ${this.document.operationName} with vars ${JSON.stringify(variables, null, 2)}`);

    return this.executeRequestAndUserCallbacks(variables, Notifier.notify);
  }

  async executeSubscription(args) {
    const [variables_, sink, options] = args;
    const variables = variables_ || {};

    Logger.info(() => `Executing subscription ${this.document.operationName} with vars ${JSON.stringify(variables, null, 2)}`);

    const client = await this.getClient();
    await client.subscribe(this.document.getQueryString(), variables, sink, options || {});
  }

  subscribe(variables, subscriber) {
    const query = this.queryRegistry.getOrCreate(variables);
    return query.addSubscriber(subscriber);
  }

  simulateNetworkResponse(data) {
    data = transform(this.document, data);
    const entities = normalizeEntities(this.document, data);
    Notifier.notify(globalCache.update(entities));
  }

  async executeRequestAndUserCallbacks(variables, handleUpdates) {
    const data = await this.executeRequest(variables, handleUpdates);

    const transformedData = this.document.transform(data);

    this.document.afterExecutionCallback(transformedData);

    return transformedData;
  }

  async executeRequest(variables, handleUpdates) {
    Logger.info(() => `Executing HTTP request for ${this.document.operationName} with vars ${JSON.stringify(variables, null, 2)}`);

    await this.maybeSimulateNetworkDelay();

    const client = await this.getClient();

    let data = await client.request(this.document.getQueryString(), variables);

    Logger.info(() => `HTTP request executed for ${this.document.operationName} with vars ${JSON.stringify(variables, null, 2)}`);
    Logger.debug(() => `Raw data: ${JSON.stringify(data, null, 2)}`);

    data = transform(this.document, data);

    data = addVirtualScalars(this.document, data);

    const context = this.document.executionContextGetter(variables, data);

    data = await deriveFromReference(this.document, data, variables, context);

    data = await deriveFrom(this.document, data, variables, context);

    data = await reference(this.document, data, variables, context);

    Logger.verbose(() => `Transformed data ${JSON.stringify(data, null, 2)}`);

    if (handleUpdates) {
      const entities = normalizeEntities(this.document, data);

      handleUpdates(globalCache.update(entities));
    }

    return data;
  }

  async maybeSimulateNetworkDelay() {
    const delay = await this.document.maybeSimulateNetworkDelay();
    if (delay === false) {
      await DocumentOptions.maybeSimulateNetworkDelayGlobally();
    }
  }

  getCache(variables) {
    const query = this.queryRegistry.get(variables);
    if (!query) {
      return null;
    }

    return query.getCachedData();
  }

  getClient() {
    const client = this.maybeClient ?? DocumentOptions.defaultClient;

    if (!client) {
      throw new Error(`no client specified for ${this.document.operationName} document and no default client found`);
    }

    return (typeof client === 'function') ? client() : client;
  }
}
