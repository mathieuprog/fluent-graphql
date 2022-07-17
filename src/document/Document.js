import RootObject from './RootObject';
import InlineFragment from './InlineFragment';
import OperationType from './OperationType';
import stringify from './stringify';
import OperationExecutor from '../execution/OperationExecutor';

export default class Document {
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

  static query(operationName = null) {
    return (new Document(OperationType.QUERY, operationName)).rootObject;
  }

  static mutation(operationName) {
    return (new Document(OperationType.MUTATION, operationName)).rootObject;
  }

  static subscription(operationName) {
    return (new Document(OperationType.SUBSCRIPTION, operationName)).rootObject;
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
}
