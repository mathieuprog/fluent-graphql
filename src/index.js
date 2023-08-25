import Client from './client/Client';
import Document from './document/Document';
import OperationType from './document/OperationType';
import Logger from './Logger';
import LogLevel from './LogLevel';
import FetchStrategy from './execution/FetchStrategy';
import GraphQLError, { findGraphQLError, findGraphQLErrorByCode } from './errors/GraphQLError';
import NotFoundInCacheError from './errors/NotFoundInCacheError';
import {default as logStatusQueries_} from './inspection/logStatusQueries';
import {default as logConsolidatedCaches_} from './inspection/logConsolidatedCaches';
import {default as consolidatedCaches_} from './inspection/consolidatedCaches';

globalThis.fql = {
  help() {
    console.log(`%c
fql - Global utility providing:

fql.setLogLevel(level)
fql.logStatusQueries()
fql.logConsolidatedCaches()
fql.consolidatedCaches()
fql.Document

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
  consolidatedCaches() {
    return consolidatedCaches_();
  },
  Document: Document
};

export {
  Client,
  Document,
  LogLevel,
  FetchStrategy,
  GraphQLError,
  findGraphQLError,
  findGraphQLErrorByCode,
  NotFoundInCacheError,
  OperationType
}
