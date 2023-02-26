import Document from '../document/Document';
import OperationType from '../document/OperationType';
import Notifier from './Notifier';
import transform from './transform';
import deriveFrom from './deriveFrom';
import deriveFromForeignKey from './deriveFromForeignKey';
import normalizeEntities from './normalizeEntities';
import { throwIfNotInstanceOfDocument } from './helpers';
import QueryRegistry from './QueryRegistry';
import FetchStrategy from './FetchStrategy';

export default class OperationExecutor {
  constructor(document, client) {
    throwIfNotInstanceOfDocument(document);
    this.document = document;
    this.maybeClient = client;
    this.queryRegistry =
      new QueryRegistry(
        document,
        Document.cacheStrategyClass,
        this.executeRequest.bind(this));
  }

  clear() {
    this.queryRegistry.removeAll();
  }

  execute(...args) {
    switch (this.document.operationType) {
      case OperationType.QUERY:
        return this.executeQuery(args);

      case OperationType.MUTATION:
        return this.executeMutation(args);

      case OperationType.SUBSCRIPTION:
        return this.executeSubscription(args);
    }
  }

  async executeQuery(args) {
    const [variables, ...rest] = args;

    const fetchStrategy = rest.at(-1)?.fetchStrategy;

    if (fetchStrategy === FetchStrategy.FETCH_FROM_NETWORK && !this.queryRegistry.has(variables)) {
      return this.document.transform(await this.executeRequest(variables));
    }

    const query = this.queryRegistry.getOrCreate(variables);

    return await query.fetch(args, fetchStrategy);
  }

  async executeMutation(args) {
    const [variables] = args;

    return this.document.transform(await this.executeRequest(variables, Notifier.notify));
  }

  async executeSubscription(args) {
    const [variables, sink, options] = args;

    const client = await this.getClient();
    await client.subscribe(this.document.getQueryString(), variables, sink, options || {});
  }

  simulateNetworkRequest(data) {
    data = transform(this.document, data);
    const entities = normalizeEntities(this.document, data);
    Notifier.notify(entities);
  }

  async executeRequest(variables, handleUpdates) {
    await this.maybeSimulateNetworkDelay();

    const client = await this.getClient();

    const queryString = this.document.getQueryString();

    let data = {};

    if (queryString) {
      data = await client.request(this.document.getQueryString(), variables);
    }

    data = transform(this.document, data);

    data = await deriveFromForeignKey(this.document, data);

    data = await deriveFrom(this.document, data, variables);

    const entities = normalizeEntities(this.document, data);

    handleUpdates && handleUpdates(entities);

    return data;
  }

  async maybeSimulateNetworkDelay() {
    const delay = await this.document.maybeSimulateNetworkDelay();
    if (delay === false) {
      await Document.maybeSimulateNetworkDelayGlobally();
    }
  }

  getCache(variables) {
    const query = this.queryRegistry.get(variables);
    if (!query) {
      return null;
    }

    return query.getCachedData();
  }

  getClient() {
    const client = this.maybeClient ?? Document.defaultClient;
    return (typeof client === 'function') ? client() : client;
  }
}
