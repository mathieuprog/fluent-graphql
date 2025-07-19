import Logger from '../Logger';
import GlobalSettings from '../document/GlobalSettings';
import OperationType from '../document/OperationType';
import FetchStrategy from './FetchStrategy';
import Notifier from './Notifier';
import QueryRegistry from './QueryRegistry';
import addVirtualScalars from './addVirtualScalars';
import deriveFrom from './deriveFrom';
import deriveFromReference from './deriveFromReference';
import updateQueue from './updateQueue';
import { throwIfNotInstanceOfDocument } from './helpers';
import normalizeEntities from './normalizeEntities';
import reference from './reference';
import transform from './transform';

export default class OperationExecutor {
  constructor(document, client) {
    throwIfNotInstanceOfDocument(document);
    this.document = document;
    this.maybeClient = client;
    this.queryRegistry = new QueryRegistry(document, this.executeForCache.bind(this));
  }

  destroyQueries() {
    this.queryRegistry.destroyAll();
  }

  destroyQueriesWhenIdle(options = {}) {
    this.queryRegistry.destroyAllWhenIdle(options);
  }

  invalidateQueryCaches(options = {}) {
    this.queryRegistry.invalidateQueryCaches(options);
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
    const fetchStrategy = options?.fetchStrategy || GlobalSettings.defaultFetchStrategy;

    Logger.info(() => `Executing (${FetchStrategy.toString(fetchStrategy)}) query ${this.document.operationName} with vars ${JSON.stringify(variables, null, 2)}`);

    if (fetchStrategy === FetchStrategy.FetchFromNetworkAndSkipCaching) {
      Logger.info('The query won\'t be cached');
      return this.executeOneOff(variables, Notifier.notify);
    }

    if (fetchStrategy === FetchStrategy.FetchFromNetworkAndSkipCachingAndCacheUpdate) {
      Logger.info('The query won\'t be cached, and cache updates will be skipped');
      return this.executeOneOff(variables);
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

    return this.executeOneOff(variables, Notifier.notify);
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

  async simulateNetworkResponse(data) {
    data = transform(this.document, data);
    const entities = normalizeEntities(this.document, data);
    await updateQueue.enqueue(entities, {
      operationName: this.document.operationName,
      variables: {}
    });
  }

  async executeOneOff(variables, handleUpdates) {
    const { dataPromise } = this.executeForCache(variables, handleUpdates);
  
    const raw = await dataPromise;
    const transformed = this.document.transform(raw);
  
    this.document.afterExecutionCallback(transformed);
    return transformed;
  }

  executeForCache(variables, handleUpdates, options = {}) {
    const controller = options.signal ? undefined : new AbortController();

    Logger.info(() => `Executing HTTP request for ${this.document.operationName} with vars ${JSON.stringify(variables, null, 2)}`);

    const run = async () => {
      await this.maybeSimulateNetworkDelay();

      const client = await this.getClient();

      let response = await client.request(
        this.document.getQueryString(),
        variables,
        { signal: options.signal ?? controller?.signal }
      );

      Logger.info(() => `HTTP request executed for ${this.document.operationName} with vars ${JSON.stringify(variables, null, 2)}`);
      Logger.debug(() => `Raw response: ${JSON.stringify(response, null, 2)}`);

      response = transform(this.document, response);

      response = addVirtualScalars(this.document, response);

      const context = this.document.executionContextGetter(variables, response);

      response = await deriveFromReference(this.document, response, variables, context);

      response = await deriveFrom(this.document, response, variables, context);

      response = reference(this.document, response, variables, context);

      Logger.verbose(() => `Transformed response ${JSON.stringify(response, null, 2)}`);

      if (handleUpdates) {
        const entities = normalizeEntities(this.document, response);

        // Use the queue to ensure serial processing
        const updates = await updateQueue.enqueue(entities, {
          operationName: this.document.operationName,
          variables
        });
        
        handleUpdates(updates);
      }

      return response;
    };

    const dataPromise = run();

    return {
      dataPromise,
      abort: controller
        ? () => controller.abort()
        : () => {
            throw new Error(
              'executeForCache was called with an external AbortSignal; ' +
              'call abort() on the AbortController that owns that signal.'
            );
          }
    };
  }

  async maybeSimulateNetworkDelay() {
    const delay = await this.document.maybeSimulateNetworkDelay();
    if (delay === false) {
      await GlobalSettings.maybeSimulateNetworkDelayGlobally();
    }
  }

  getCache(variables) {
    const query = this.queryRegistry.get(variables);
    return query ? query.getCachedData() : null;
  }

  getClient() {
    const client = this.maybeClient ?? GlobalSettings.defaultClient;

    if (!client) {
      throw new Error(`no client specified for ${this.document.operationName} document and no default client found`);
    }

    return typeof client === 'function' ? client() : client;
  }
}
