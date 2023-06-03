export default class QueryExecutor {
  constructor(document, variables) {
    this.document = document;
    this.variables = variables;
  }

  execute(options = {}) {
    return this.document.getExecutor().execute(this.variables, options);
  }

  subscribe(subscriber) {
    return this.document.getExecutor().subscribe(this.variables, subscriber);
  }
}
