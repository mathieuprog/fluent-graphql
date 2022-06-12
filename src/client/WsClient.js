import { createClient } from 'graphql-ws';
import { isEmptyObjectLiteral, takeProperties } from 'object-array-utils';

export default class WsClient {
  constructor(params = {}) {
    this.client = createClient(params);
  }

  subscribe(query, variables, sink, options = {}) {
    let rejectedSinkSubset;
    ({ filtered: sink, rejected: rejectedSinkSubset } = takeProperties(sink, ['next', 'complete', 'error']));

    if (!isEmptyObjectLiteral(rejectedSinkSubset)) {
      throw new Error(`sink object contains invalid props: ${Object.keys(rejectedSinkSubset).join(', ')}`);
    }

    return this.client.subscribe({ query, variables, ...options }, sink);
  }
}
