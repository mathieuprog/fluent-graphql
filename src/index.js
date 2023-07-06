import Client from './client/Client';
import Document from './document/Document';
import Logger from './Logger';
import LogLevel from './LogLevel';
import FetchStrategy from './execution/FetchStrategy';
import GraphQLError, { findGraphQLError, findGraphQLErrorByCode } from './errors/GraphQLError';
import NotFoundInCacheError from './errors/NotFoundInCacheError';
import {default as logStatusQueries_} from './inspection/logStatusQueries';
import {default as logConsolidatedCaches_} from './inspection/logConsolidatedCaches';

globalThis.fql = {
  help() {
    console.log(`%c
fql - Global utility providing:

fql.setLogLevel(level)
fql.logStatusQueries()
fql.logConsolidatedCaches()
fql.document(operationType, operationName)
fql.query(operationName)
fql.mutation(operationName)
fql.subscription(operationName)

With a document instance, simulate server response:
documentInstance.simulateNetworkResponse(data)
`, 'color: aqua');
  },
  setLogLevel(level) {
    Logger.setLogLevel(level);
  },
  logStatusQueries() {
    logStatusQueries_();
  },
  logConsolidatedCaches() {
    logConsolidatedCaches_();
  },
  document(operationType, operationName) {
    const document = Document.instances.filter((document) => {
      return document.operationType === operationType
          && document.operationName === operationName;
    });

    if (document.length === 0) {
      return null;
    }

    if (document.length > 1) {
      throw new Error('More than one document instance found for the same operation name');
    }

    return document[0];
  },
  query(operationName = null) {
    return Document.query(operationName);
  },
  mutation(operationName) {
    return Document.mutation(operationName);
  },
  subscription(operationName) {
    return Document.subscription(operationName);
  }
};

export {
  Client,
  Document,
  LogLevel,
  FetchStrategy,
  GraphQLError,
  findGraphQLError,
  findGraphQLErrorByCode,
  NotFoundInCacheError
}
