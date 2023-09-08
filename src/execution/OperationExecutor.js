import Document from '../document/Document';
import OperationType from '../document/OperationType';
import Notifier from './Notifier';
import transform from './transform';
import deriveFrom from './deriveFrom';
import deriveFromForeignKey from './deriveFromForeignKey';
import normalizeEntities from './normalizeEntities';
import { throwIfNotInstanceOfDocument } from './helpers';
import QueryRegistry from './QueryRegistry';
import FetchStrategy from './FetchStrategy';
import Logger from '../Logger';

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

  async executeQuery(args) {
    const [variables_, options] = args;
    const variables = variables_ || {};
    const fetchStrategy = options?.fetchStrategy || Document.defaultFetchStrategy;

    Logger.info(() => `Executing (${FetchStrategy.toString(fetchStrategy)}) query ${this.document.operationName} with vars ${JSON.stringify(variables, null, 2)}`);

    if (fetchStrategy === FetchStrategy.FetchFromNetworkAndNoCache) {
      Logger.info('The query won\'t be cached, and cache updates will be skipped');
      return this.document.transform(await this.executeRequest(variables));
    }

    const query = this.queryRegistry.getOrCreate(variables);

    const data = await query.fetch(fetchStrategy);
    Logger.verbose(() => `Return query data ${JSON.stringify(data, null, 2)}`);
    return data;
  }

  async executeMutation(args) {
    const [variables_] = args;
    const variables = variables_ || {};

    Logger.info(() => `Executing mutation ${this.document.operationName} with vars ${JSON.stringify(variables, null, 2)}`);

    return this.document.transform(await this.executeRequest(variables, Notifier.notify));
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
    Notifier.notify(entities);
  }

  async executeRequest(variables, handleUpdates) {
    Logger.info(() => `Executing HTTP request for ${this.document.operationName} with vars ${JSON.stringify(variables, null, 2)}`);

    let context = this.document.executionContextGetter();

    await this.maybeSimulateNetworkDelay();

    const client = await this.getClient();

    let data = await client.request(this.document.getQueryString(), variables);

    Logger.info(() => `HTTP request executed for ${this.document.operationName} with vars ${JSON.stringify(variables, null, 2)}`);
    Logger.debug(() => `Raw data: ${JSON.stringify(data, null, 2)}`);

    data = transform(this.document, data);


    context = { ...context, __data: data };

    data = await deriveFromForeignKey(this.document, data, variables, context);

    data = await deriveFrom(this.document, data, variables, context);

    const entities = normalizeEntities(this.document, data);

    Logger.verbose(() => `Transformed data ${JSON.stringify(data, null, 2)}`);

    handleUpdates && handleUpdates(entities);

    return data;
  }

  async maybeSimulateNetworkDelay() {
    const delay = await this.document.maybeSimulateNetworkDelay();
    if (delay === false) {
      await Document.maybeSimulateNetworkDelayGlobally();
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
    const client = this.maybeClient ?? Document.defaultClient;

    if (!client) {
      throw new Error(`no client specified for ${this.document.operationName} document and no default client found`);
    }

    return (typeof client === 'function') ? client() : client;
  }
}
