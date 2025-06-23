import ky from 'ky';
import { isEmptyObjectLiteral } from 'object-array-utils';
import GraphQLError from '../errors/GraphQLError';

export default class HttpClient {
  constructor(params = {}) {
    this.url = params.url;
    delete params.url;
    this.params = params;
  }

  async request(query, variables = {}) {
    const json =
      (isEmptyObjectLiteral(variables))
      ? { query }
      : { query, variables };

    const { data, errors } = await ky.post(this.url, { json, timeout: 30000, ...this.params }).json();

    if (errors) {
      const operationName = query.match(/\b(\w+)(?=[\{\(])/)?.[1];
      throw new GraphQLError(errors, operationName, variables);
    }

    return data;
  }
}
