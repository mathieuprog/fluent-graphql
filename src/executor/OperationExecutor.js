import Document from '../document/Document';
import OperationType from '../document/OperationType';
import QueryForVars from './QueryForVars';
import Notifier from './Notifier';
import transform from './transform';
import deriveFromForeignKey from './deriveFromForeignKey';
import normalizeEntities from './normalizeEntities';
import AutoUnsubscriber from './AutoUnsubscriber';
import FetchStrategy from './FetchStrategy';

export default class OperationExecutor {
  static allQueriesForVars = {};

  constructor(document, client) {
    if (document instanceof Document === false) {
      throw new Error();
    }
    this.document = document;
    this.client = client;
    this.queriesForVars = {};
  }

  unsubscribeOnSubsequentCalls() {
    return new AutoUnsubscriber(this);
  }

  async execute(...args) {
    const [variables, arg2, arg3, arg4] = args;

    switch (this.document.operationType) {
      case OperationType.QUERY:
        let subscriber;
        let returnUnsubscriber;
        let options;

        if (typeof arg2 === 'function') {
          subscriber = arg2;
          returnUnsubscriber = arg3;
          options = arg4;
        } else {
          options = arg2;
        }

        const fetchStrategy = options?.fetchStrategy || FetchStrategy.CACHE_FIRST;

        switch (fetchStrategy) {
          case FetchStrategy.NO_CACHE:
            return this.document.transform(await this.executeRequest(variables));

          case FetchStrategy.STANDBY:
            return this.queriesForVars[JSON.stringify(variables)]?.cache?.transformedData
              ?? this.document.transform(await this.executeRequest(variables, Notifier.notify));

          default:
            const queryForVars = this.getQueryForVars(variables);

            if (subscriber) {
              const unsubscribe = queryForVars.subscribe(subscriber);
              returnUnsubscriber(unsubscribe);
            }

            await queryForVars.fetchByStrategy(fetchStrategy, Notifier.notify);

            queryForVars.listen(() => Notifier.subscribe(queryForVars));

            return queryForVars.cache.transformedData;
        }

      case OperationType.MUTATION:
        return this.document.transform(this.executeRequest(variables, Notifier.notify));

      case OperationType.SUBSCRIPTION: {
        const sink = arg2;
        const options = arg3;

        const client = await this.client;
        await client.subscribe(this.document.getQueryString(), variables, sink, options || {});
      } return;
    }
  }

  async executeRequest(variables, handleUpdates) {
    const client = await this.client;

    let data = await client.request(this.document.getQueryString(), variables);

    data = transform(this.document, data);

    data = deriveFromForeignKey(this.document, data);

    const entities = normalizeEntities(this.document, data);

    handleUpdates && handleUpdates(entities);

    return data;
  }

  getQueryForVars(variables) {
    const stringifiedVars = JSON.stringify(variables);

    if (!this.queriesForVars[stringifiedVars]) {
      this.queriesForVars[stringifiedVars] =
        new QueryForVars(
          this.document,
          variables,
          () => this.executeRequest(variables, Notifier.notify),
          () => this.removeQueryForVars(variables),
          Notifier.notify
        );
      OperationExecutor.allQueriesForVars[`${this.document.operationName}:${stringifiedVars}`] = this.queriesForVars[stringifiedVars];
    }

    return this.queriesForVars[stringifiedVars];
  }

  removeQueryForVars(variables) {
    const stringifiedVars = JSON.stringify(variables);
    delete this.queriesForVars[stringifiedVars];
    delete OperationExecutor.allQueriesForVars[`${this.document.operationName}:${stringifiedVars}`];
  }

  static getCache(operationName, variables) {
    const stringifiedVars = JSON.stringify(variables);
    return this.allQueriesForVars[`${operationName}:${stringifiedVars}`]?.cache?.transformedData || null;
  }
}
