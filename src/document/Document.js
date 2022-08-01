import RootObject from './RootObject';
import InlineFragment from './InlineFragment';
import OperationType from './OperationType';
import stringify from './stringify';
import OperationExecutor from '../execution/OperationExecutor';

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
    this.maybeSimulateNetworkDelay = () => false;
  }

  clear() {
    this.executor.clear();
    this.executor = null;
    Document.instances = Document.instances.filter((instance) => instance !== this);
  }

  static query(operationName = null) {
    const document = new Document(OperationType.QUERY, operationName);
    Document.instances.push(document);
    return document.rootObject;
  }

  static mutation(operationName) {
    const document = new Document(OperationType.MUTATION, operationName);
    Document.instances.push(document);
    return document.rootObject;
  }

  static subscription(operationName) {
    const document = new Document(OperationType.SUBSCRIPTION, operationName);
    Document.instances.push(document);
    return document.rootObject;
  }

  static setDefaultClient(client) {
    Document.defaultClient = client;
  }

  static simulateNetworkDelayGlobally(min, max) {
    Document.maybeSimulateNetworkDelayGlobally =
      () => Document.doSimulateNetworkDelay(min, max);
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
    if (!this.queryString) {
      this.queryString = stringify(this);
    }
    return this.queryString;
  }

  prepareQueryString() {
    this.getQueryString();
    return this;
  }

  makeExecutable(client = null) {
    this.getQueryString();
    this.executor = new OperationExecutor(this, client);
    return this;
  }

  getExecutor() {
    if (!this.executor) {
      throw new Error('makeExecutable() has not been called');
    }

    return this.executor;
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

  handleReactivity() {
    return this.executor.unsubscribeOnSubsequentCalls();
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

  static logStatusQueries() {
    console.group('Fluent GraphQL queries');

    for (let document of this.instances) {
      if (document.operationType !== OperationType.QUERY || !document.executor) {
        continue;
      }
      console.group('document', document.operationName);

      const queriesForVars = document.executor.queriesForVars;

      console.log('query count:', Object.keys(queriesForVars).length);

      for (const [stringifiedVars, queryForVars] of Object.entries(queriesForVars)) {
        console.group('variables', stringifiedVars);
        console.log('cached data:', !!queryForVars.cache?.transformedData);
        console.log('listens network:', !!queryForVars.unsubscriber);
        console.log('subscriber count:', queryForVars.subscribers.size);
        console.groupEnd();
      }

      console.groupEnd();
    }

    console.groupEnd();
  }
}
