import { toSortedObject } from 'object-array-utils';
import Logger from '../Logger';
import FetchStrategy from '../execution/FetchStrategy';
import OperationExecutor from '../execution/OperationExecutor';
import QueryExecutor from '../execution/QueryExecutor';
import DocumentOptions from './DocumentOptions';
import InlineFragmentFactory from './InlineFragmentFactory';
import OperationType from './OperationType';
import RootObject from './RootObject';
import stringify from './stringify';

export default class Document {
  static instances = [];

  constructor(operationType, operationName) {
    this.operationType = operationType;
    this.operationName = operationName;
    this.variableDefinitions = {};
    this.rootObject = new RootObject(this, new InlineFragmentFactory(this));
    this.queryString = null;
    this.transform = (data) => data;
    this.afterExecutionCallback = (_data) => {};
    this.clearAfterDuration = null;
    this.pollAfterDuration = null;
    this.executor = null;
    this.queryExecutors = {};
    this.maybeSimulateNetworkDelay = () => false;
    this.refetchStrategy = FetchStrategy.FetchFromNetwork;
    this.executionContextGetter = () => {};
    this.filterEntityCallback = (_entity) => true;
    this.getTenantsCallback = null;
    this.possibleTypenames = [];
  }

  static query(operationName = null) {
    operationName && this.getByOperationName(OperationType.Query, operationName); // throws if already exists

    const document = new Document(OperationType.Query, operationName);
    this.instances.push(document);
    return document.rootObject;
  }

  static mutation(operationName) {
    operationName && this.getByOperationName(OperationType.Mutation, operationName); // throws if already exists

    const document = new Document(OperationType.Mutation, operationName);
    this.instances.push(document);
    return document.rootObject;
  }

  static subscription(operationName) {
    operationName && this.getByOperationName(OperationType.Subscription, operationName); // throws if already exists

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
      throw new Error(`more than one document instance found for the same operation name: ${operationName}`);
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
    DocumentOptions.defaultClient = client;
  }

  static setDefaultFetchStrategy(strategy) {
    DocumentOptions.defaultFetchStrategy = strategy;
  }

  static simulateNetworkDelayGlobally(min, max) {
    DocumentOptions.maybeSimulateNetworkDelayGlobally =
      () => this.doSimulateNetworkDelay(min, max);
  }

  static async doSimulateNetworkDelay(min, max) {
    const delay = Math.round(Math.random() * (max - min) + min);
    Logger.debug(`Added ${delay}ms network delay simulation`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return delay;
  }

  static defineTenantFields(getTenantsByTypenameFun) {
    DocumentOptions.getTenantsByTypename = getTenantsByTypenameFun;
  }

  static clearQueries(operationNames) {
    const hasDuplicates = (array) => (new Set(array)).size !== array.length;
    if (hasDuplicates(operationNames)) {
      throw new Error(`array ${operationNames.join(', ')} passed to \`clearQueries(operationNames)\` contains duplicates`);
    }

    operationNames.forEach((operationName) =>
      this.getByOperationName(OperationType.Query, operationName)?.document.clearQueries());
  }

  static clearAllQueries() {
    this.instances.forEach((document) => {
      if (document.operationType === OperationType.Query) {
        document.clearQueries();
      }
    });
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

    const variablesAsString = JSON.stringify(toSortedObject(variables));

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
    if (typeof fun !== 'function') {
      throw new Error('transformResponse(fun) should receive a function as argument');
    }
    this.transform = (data) => {
      const result = fun(data);
      if (result === undefined) {
        throw new Error('transformResponse callback returned undefined');
      }
      return result;
    };
    return this;
  }

  addPossibleTypenames(typenames) {
    this.possibleTypenames = this.possibleTypenames.concat(typenames);
  }

  filterEntity(fun) {
    if (typeof fun !== 'function') {
      throw new Error('filterEntity(fun) should receive a function as argument');
    }
    this.filterEntityCallback = fun;
    return this;
  }

  scopeByTenants(fun) {
    if (typeof fun !== 'function') {
      throw new Error('getTenants(fun) should receive a function as argument');
    }
    this.getTenantsCallback = fun;
    return this;
  }

  afterExecution(fun) {
    if (typeof fun !== 'function') {
      throw new Error('afterExecution(fun) should receive a function as argument');
    }
    this.afterExecutionCallback = fun;
    return this;
  }

  getRefetchStrategy() {
    return this.refetchStrategy;
  }

  setRefetchStrategy(fetchStrategy) {
    this.refetchStrategy = fetchStrategy;
    return this;
  }

  createExecutionContext(executionContextGetter) {
    this.executionContextGetter = executionContextGetter;
    return this;
  }

  invalidateAllCaches() {
    this.executor.invalidateAllCaches();
    return this;
  }

  clearQueries() {
    this.invalidateAllCaches();
    this.executor.clearQueries();
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
