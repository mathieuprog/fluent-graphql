import RootObject from './RootObject';
import OperationType from './OperationType';
import stringify from './stringify';

export default class Document {
  constructor(operationType, operationName) {
    this.operationType = operationType;
    this.operationName = operationName;
    this.variableDefinitions = {};
    this.rootObject = new RootObject(this);
    this.queryString = null;
    this.transform = (data) => data;
    this.clearAfterDuration = null;
    this.pollAfterDuration = null;
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

  transformResponse(fun) {
    this.transform = fun;
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
