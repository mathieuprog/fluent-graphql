import { hasArrayDuplicates, isNullish, toSortedObject } from 'object-array-utils';
import Logger from '../Logger';
import FetchStrategy from '../execution/FetchStrategy';
import OperationExecutor from '../execution/OperationExecutor';
import QueryExecutor from '../execution/QueryExecutor';
import globalCache from '../execution/globalCache';
import GlobalSettings from './GlobalSettings';
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
    this.destroyIdleAfterDuration = null;
    this.pollAfterDuration = null;
    this.executor = null;
    this.queryExecutors = {};
    this.maybeSimulateNetworkDelay = () => Promise.resolve(false);
    this.refetchStrategy = FetchStrategy.FetchFromNetwork;
    this.executionContextGetter = () => ({});
    this.filterEntityCallback = (_entity) => true;
    this.getTenantsCallback = null;
    this.possibleTypenames = [];
  }

  static query(operationName) {
    return this._createDocumentOfType(OperationType.Query, operationName);
  }

  static mutation(operationName) {
    return this._createDocumentOfType(OperationType.Mutation, operationName);
  }

  static subscription(operationName) {
    return this._createDocumentOfType(OperationType.Subscription, operationName);
  }

  static _createDocumentOfType(operationType, operationName) {
    this._validateUniqueOperationName(operationType, operationName);
    
    const document = new Document(operationType, operationName);
    this.instances.push(document);
    return document.rootObject;
  }

  static _validateUniqueOperationName(operationType, operationName) {
    if (!operationName) {
      throw new Error('operation name is required');
    }
    this.getByOperationName(operationType, operationName);
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
    GlobalSettings.defaultClient = client;
  }

  static setDefaultFetchStrategy(strategy) {
    GlobalSettings.defaultFetchStrategy = strategy;
  }

  static simulateNetworkDelayGlobally(min, max) {
    GlobalSettings.maybeSimulateNetworkDelayGlobally =
      () => this.doSimulateNetworkDelay(min, max);
  }

  static async doSimulateNetworkDelay(min, max) {
    const delay = Math.round(Math.random() * (max - min) + min);
    Logger.debug(`Added ${delay}ms network delay simulation`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return delay;
  }

  static defineTenantFields(getTenantsByTypenameFun) {
    GlobalSettings.getTenantsByTypename = getTenantsByTypenameFun;
  }

  static destroyQueries(operationNames) {
    if (hasArrayDuplicates(operationNames)) {
      throw new Error(`array ${operationNames.join(', ')} passed to \`destroyQueries(operationNames)\` contains duplicates`);
    }

    operationNames.forEach((operationName) => {
      const instances = this.instances.filter((document) => {
        return document.operationType === OperationType.Query
            && document.operationName === operationName;
        });
        
      instances.forEach((instance) => {
        instance.destroyQueries();
      });
    });
  }

  static resetAll() {
    this.instances.forEach((document) => {
      if (document.operationType === OperationType.Query) {
        document.destroyQueries();
      }
    });
    globalCache.clear();
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
    this.freeze();
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

  freeze() {
    this.freezeNodeRecursively(this.rootObject);
    Object.freeze(this);
    return this;
  }

  freezeNodeRecursively(node) {
    if (isNullish(node)) {
      throw new Error('Node is null or undefined');
    }

    if (typeof node !== 'object') {
      throw new Error('Node is not an object');
    }

    if (node.objects) {
      Object.values(node.objects).forEach(childNode => {
        this.freezeNodeRecursively(childNode);
      });
    }

    if (node.inlineFragments) {
      Object.values(node.inlineFragments).forEach(fragment => {
        this.freezeNodeRecursively(fragment);
      });
    }

    Object.freeze(node);
  }

  invalidateQueryCaches() {
    this.executor?.invalidateQueryCaches();
    return this;
  }

  destroyQueries() {
    this.invalidateQueryCaches();
    this.executor?.destroyQueries();
    this.queryExecutors = {};
    return this;
  }

  destroyIdleAfter(duration) {
    this.destroyIdleAfterDuration = duration;
    return this;
  }

  pollAfter(duration) {
    this.pollAfterDuration = duration;
    return this;
  }
}
