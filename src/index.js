import Client from './client/Client';
import Document from './document/Document';
import FetchStrategy from './execution/FetchStrategy';
import GraphQLError, { findGraphQLError } from './errors/GraphQLError';
import NotFoundInCacheError from './errors/NotFoundInCacheError';

globalThis.FluentGraphQL = {
  logStatusQueries() {
    Document.logStatusQueries();
  }
}

export {
  Client,
  Document,
  FetchStrategy,
  GraphQLError,
  findGraphQLError,
  NotFoundInCacheError
}
