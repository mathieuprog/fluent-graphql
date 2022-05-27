export default class AutoUnsubscriber {
  constructor(operationExecutor) {
    this.operationExecutor = operationExecutor;
    this.prevUnsubscriber = null;
  }

  execute(variables, subscriber, returnUnsubscriber, options = {}) {
    if (this.prevUnsubscriber) {
      this.prevUnsubscriber();
    }

    const getUnsubscriber = (unsubscriber) => {
      this.prevUnsubscriber = unsubscriber;
      returnUnsubscriber(unsubscriber);
    };

    return this.operationExecutor.execute(variables, subscriber, getUnsubscriber, options);
  }
}
