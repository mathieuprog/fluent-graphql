import HttpClient from './HttpClient';
import WsClient from './WsClient';

export default class Client {
  constructor(httpParams = {}, wsParams = {}) {
    this.httpClient = (httpParams.url) ? new HttpClient(httpParams) : null;
    this.wsClient = (wsParams.url) ? new WsClient(wsParams) : null;
  }

  request(query, variables) {
    if (!this.httpClient) {
      throw new Error('no http client configured');
    }
    return this.httpClient.request(query, variables);
  }

  subscribe(query, variables, sink, options = {}) {
    if (!this.wsClient) {
      throw new Error('no ws client configured');
    }
    return this.wsClient.subscribe(query, variables, sink, options);
  }
}
