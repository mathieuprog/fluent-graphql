import Document from '../document/Document';
import OperationType from '../document/OperationType';

export default function logStatusQueries() {
  console.group('Fluent GraphQL queries');

  for (let document of Document.instances) {
    if (document.operationType !== OperationType.QUERY || !document.executor) {
      continue;
    }
    console.group('document', document.operationName);

    const queryRegistry = document.executor.queryRegistry.registry;

    console.log('query count:', Object.keys(queryRegistry).length);

    for (const [stringifiedVars, query] of Object.entries(queryRegistry)) {
      console.group('variables', stringifiedVars);
      console.log('cached data:', !!query.getCachedData());
      console.log('listens network:', !!query.unsubscriber);
      console.log('subscriber count:', query.cacheStrategy?.subscribers.size);
      console.groupEnd();
    }

    console.groupEnd();
  }

  console.groupEnd();
}
