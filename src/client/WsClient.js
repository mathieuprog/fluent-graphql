import { createClient } from 'graphql-ws';
import { isEmptyPlainObject, partitionProperties } from 'object-array-utils';

export default class WsClient {
  constructor(params = {}) {
    this.client = createClient(params);
  }

  subscribe(query, variables, sink, options = {}) {
    let rejectedSinkSubset;
    ({ picked: sink, omitted: rejectedSinkSubset } = partitionProperties(sink, ['next', 'complete', 'error']));

    if (!isEmptyPlainObject(rejectedSinkSubset)) {
      throw new Error(`sink object contains invalid props: ${Object.keys(rejectedSinkSubset).join(', ')}`);
    }

    return this.client.subscribe({ query, variables, ...options }, sink);
  }
}
