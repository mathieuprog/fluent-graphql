import Client from './client/Client';
import Document from './document/Document';
import FetchStrategy from './execution/FetchStrategy';
import GraphQLError, { findGraphQLError } from './errors/GraphQLError';
import NotFoundInCacheError from './errors/NotFoundInCacheError';

globalThis.FluentGraphQL = {
  logStatusQueries() {
    Document.logStatusQueries();
  },
  document(name) {
    const document = Document.instances.filter((document) => document.operationName === name);
    if (document.length === 0) {
      return null;
    }
    if (document.length > 1) {
      throw new Error('More than one document instance found for the same operation name');
    }
    return document[0];
  }
};

export {
  Client,
  Document,
  FetchStrategy,
  GraphQLError,
  findGraphQLError,
  NotFoundInCacheError
}
