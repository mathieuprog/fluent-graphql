import { sortProperties } from 'object-array-utils';
import RootObject from './RootObject';
import InlineFragment from './InlineFragment';
import OperationType from './OperationType';
import stringify from './stringify';
import OperationExecutor from '../execution/OperationExecutor';
import QueryExecutor from '../execution/QueryExecutor';
import FetchStrategy from '../execution/FetchStrategy';
import Logger from '../Logger';

export default class Document {
  static instances = [];
  static defaultClient = null;
  static defaultFetchStrategy = FetchStrategy.FetchFromCacheOrFallbackNetwork;
  static maybeSimulateNetworkDelayGlobally = () => false;

  constructor(operationType, operationName) {
    this.operationType = operationType;
    this.operationName = operationName;
    this.variableDefinitions = {};
    this.rootObject = new RootObject(this);
    this.queryString = null;
    this.transform = (data) => data;
    this.afterExecutionCallback = (_data) => {};
    this.clearAfterDuration = null;
    this.pollAfterDuration = null;
    this.executor = null;
    this.queryExecutors = {};
    this.maybeSimulateNetworkDelay = () => false;
    this.executionContextGetter = () => {};
  }

  static query(operationName = null) {
    const document = new Document(OperationType.Query, operationName);
    this.instances.push(document);
    return document.rootObject;
  }

  static mutation(operationName) {
    const document = new Document(OperationType.Mutation, operationName);
    this.instances.push(document);
    return document.rootObject;
  }

  static subscription(operationName) {
    const document = new Document(OperationType.Subscription, operationName);
    this.instances.push(document);
    return document.rootObject;
  }

  static getByOperationName(operationType, operationName) {
    const document = this.instances.filter((document) => {
      return document.operationType === operationType
          && document.operationName === operationName;
    });

    if (document.length === 0) {
      return null;
    }

    if (document.length > 1) {
      throw new Error('More than one document instance found for the same operation name');
    }

    return document[0].rootObject;
  }

  static getOrCreateByOperationName(operationType, operationName) {
    const rootObject = this.getByOperationName(operationType, operationName);
    if (rootObject) {
      return rootObject;
    }

    const document = new Document(operationType, operationName);
    this.instances.push(document);
    return document.rootObject;
  }

  static setLogLevel(level) {
    Logger.setLogLevel(level);
  }

  static setDefaultClient(client) {
    this.defaultClient = client;
  }

  static setDefaultFetchStrategy(strategy) {
    this.defaultFetchStrategy = strategy;
  }

  static simulateNetworkDelayGlobally(min, max) {
    this.maybeSimulateNetworkDelayGlobally =
      () => this.doSimulateNetworkDelay(min, max);
  }

  static async doSimulateNetworkDelay(min, max) {
    const delay = Math.round(Math.random() * (max - min) + min);
    Logger.debug(`Added ${delay}ms network delay simulation`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return delay;
  }

  static createInlineFragment(parent, type, typename) { // added this here to avoid a cyclic dependency error
    return new InlineFragment(parent, type, typename);
  }

  simulateNetworkDelay(min, max) {
    this.maybeSimulateNetworkDelay =
      () => Document.doSimulateNetworkDelay(min, max);
    return this;
  }

  getQueryString() {
    this.prepareQueryString();
    return this.queryString;
  }

  prepareQueryString() {
    if (!this.queryString) {
      this.queryString = stringify(this);
    }
    return this;
  }

  makeExecutable(client = null) {
    this.prepareQueryString();
    this.executor = new OperationExecutor(this, client);
    return this;
  }

  getExecutor() {
    if (!this.executor) {
      throw new Error('makeExecutable() has not been called');
    }

    return this.executor;
  }

  getQueryExecutor(variables) {
    if (this.operationType !== OperationType.Query) {
      throw new Error();
    }

    if (!this.executor) {
      throw new Error('makeExecutable() has not been called');
    }

    const variablesAsString = JSON.stringify(sortProperties(variables));

    let queryExecutor = this.queryExecutors[variablesAsString];
    if (!queryExecutor) {
      queryExecutor = new QueryExecutor(this, variables);
      this.queryExecutors[variablesAsString] = queryExecutor;
    }

    return queryExecutor;
  }

  setExecutor(executor) {
    this.executor = executor;
  }

  execute(...args) {
    if (!this.executor) {
      throw new Error('makeExecutable() has not been called');
    }

    return this.executor.execute(...args);
  }

  invalidateAllCaches() {
    this.executor.invalidateAllCaches();
    return this;
  }

  clearQueries() {
    this.executor.clearQueries();
    return this;
  }

  subscribe(variables, subscriber) {
    if (!this.executor) {
      throw new Error('makeExecutable() has not been called');
    }

    return this.executor.addSubscriber(variables, subscriber);
  }

  simulateNetworkResponse(data) {
    if (!this.executor) {
      throw new Error('makeExecutable() has not been called');
    }

    return this.executor.simulateNetworkResponse(data);
  }

  transformResponse(fun) {
    this.transform = (data) => {
      const result = fun(data);
      if (result === undefined) {
        throw new Error('transformResponse callback returned undefined');
      }
      return result;
    };
    return this;
  }

  afterExecution(fun) {
    this.afterExecutionCallback = fun;
    return this;
  }

  createExecutionContext(executionContextGetter) {
    this.executionContextGetter = executionContextGetter;
    return this;
  }

  clearAfter(duration) {
    this.clearAfterDuration = duration;
    return this;
  }

  pollAfter(duration) {
    this.pollAfterDuration = duration;
    return this;
  }
}
