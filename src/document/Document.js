import RootObject from './RootObject';
import InlineFragment from './InlineFragment';
import OperationType from './OperationType';
import stringify from './stringify';
import OperationExecutor from '../execution/OperationExecutor';
import DefaultCacheStrategy from '../execution/cache/strategies/DefaultCacheStrategy';

export default class Document {
  static instances = [];
  static defaultClient = null;
  static cacheStrategyClass = DefaultCacheStrategy;
  static maybeSimulateNetworkDelayGlobally = () => false;

  constructor(operationType, operationName) {
    this.operationType = operationType;
    this.operationName = operationName;
    this.variableDefinitions = {};
    this.rootObject = new RootObject(this);
    this.queryString = null;
    this.transform = (data) => data;
    this.clearAfterDuration = null;
    this.pollAfterDuration = null;
    this.executor = null;
    this.maybeSimulateNetworkDelay = () => false;
  }

  clear() {
    this.executor.clear();
    this.executor = null;
    Document.instances = Document.instances.filter((instance) => instance !== this);
  }

  static query(operationName = null) {
    const document = new Document(OperationType.QUERY, operationName);
    this.instances.push(document);
    return document.rootObject;
  }

  static mutation(operationName) {
    const document = new Document(OperationType.MUTATION, operationName);
    this.instances.push(document);
    return document.rootObject;
  }

  static subscription(operationName) {
    const document = new Document(OperationType.SUBSCRIPTION, operationName);
    this.instances.push(document);
    return document.rootObject;
  }

  static setDefaultClient(client) {
    this.defaultClient = client;
  }

  static setCacheStrategy(className) {
    this.cacheStrategyClass = className;
  }

  static simulateNetworkDelayGlobally(min, max) {
    this.maybeSimulateNetworkDelayGlobally =
      () => this.doSimulateNetworkDelay(min, max);
  }

  static async doSimulateNetworkDelay(min, max) {
    const delay = Math.round(Math.random() * (max - min) + min);
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

  setExecutor(executor) {
    this.executor = executor;
  }

  execute(...args) {
    if (!this.executor) {
      throw new Error('makeExecutable() has not been called');
    }

    return this.executor.execute(...args);
  }

  simulateNetworkRequest(data) {
    if (!this.executor) {
      throw new Error('makeExecutable() has not been called');
    }

    return this.executor.simulateNetworkRequest(data);
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

  clearAfter(duration) {
    this.clearAfterDuration = duration;
    return this;
  }

  pollAfter(duration) {
    this.pollAfterDuration = duration;
    return this;
  }
}
