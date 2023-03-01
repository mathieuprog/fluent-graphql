import HttpClient from './HttpClient';
import WsClient from './WsClient';

export default class Client {
  constructor({ http, ws }) {
    this.httpClient = (http.url) ? new HttpClient(http) : null;
    this.wsClient = (ws.url) ? new WsClient(ws) : null;
  }

  request(query, variables) {
    if (!this.httpClient) {
      throw new Error('no HTTP client configured');
    }
    return this.httpClient.request(query, variables);
  }

  subscribe(query, variables, sink, options = {}) {
    if (!this.wsClient) {
      throw new Error('no WebSocket client configured');
    }
    return this.wsClient.subscribe(query, variables, sink, options);
  }
}
