import Document from "../document/Document";
import OperationType from "../document/OperationType";

export default function logStatusQueries() {
  console.group('Fluent GraphQL queries');

  for (let document of Document.instances) {
    if (document.operationType !== OperationType.QUERY || !document.executor) {
      continue;
    }
    console.group('document', document.operationName);

    const queriesForVars = document.executor.queriesForVars;

    console.log('query count:', Object.keys(queriesForVars).length);

    for (const [stringifiedVars, queryForVars] of Object.entries(queriesForVars)) {
      console.group('variables', stringifiedVars);
      console.log('cached data:', !!queryForVars.cache?.transformedData);
      console.log('listens network:', !!queryForVars.unsubscriber);
      console.log('subscriber count:', queryForVars.subscribers.size);
      console.groupEnd();
    }

    console.groupEnd();
  }

  console.groupEnd();
}
