import { sortProperties } from 'object-array-utils';
import RootObject from './RootObject';
import InlineFragment from './InlineFragment';
import OperationType from './OperationType';
import stringify from './stringify';
import OperationExecutor from '../execution/OperationExecutor';
import QueryExecutor from '../execution/QueryExecutor';

export default class Document {
  static instances = [];
  static defaultClient = null;
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
    this.queryExecutors = {};
    this.maybeSimulateNetworkDelay = () => false;
  }

  clear() {
    this.executor.clear();
    this.executor = null;
    Document.instances = Document.instances.filter((instance) => instance !== this);
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

  static setDefaultClient(client) {
    this.defaultClient = client;
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
