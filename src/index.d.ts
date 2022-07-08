declare module "fluent-graphql" {
  export enum FetchStrategy {
    FetchFromCacheOrThrow = "FETCH_FROM_CACHE_OR_THROW",
    FetchFromCacheOrFallbackNetwork = "FETCH_FROM_CACHE_OR_FALLBACK_NETWORK",
    FetchFromCacheAndNetwork = "FETCH_FROM_CACHE_AND_NETWORK",
    FetchFromNetwork = "FETCH_FROM_NETWORK",
  }

  interface HttpClient {
    url: string;
    [key: string]: any;
  }

  interface WsClient {
    url: string;
    [key: string]: any;
  }

  export class Client {
    constructor({ http: HttpClient, ws: WsClient });
  }

  export class NotFoundInCacheError extends Error {}

  export class GraphQLError extends Error {}

  export class Document {
    query(operationName: string | null): Document;
    mutation(operationName: string): Document;
    subscription(operationName: string): Document;
    setDefaultClient(client: Client): void;
    makeExecutable(client: Client | null): Document;
    execute(
      variables: { [key: string]: any }
    ): Promise<any>;
    execute(
      variables: { [key: string]: any },
      options: { [key: string]: any } | null
    ): Promise<any>;
    execute(
      variables: { [key: string]: any },
      subscriber: (data: { [key: string]: any }) => void,
      returnUnsubscriber: (unsubscriber: () => void) => void,
      options: { [key: string]: any } | null
    ): Promise<any>;
    execute(
      variables: { [key: string]: any },
      sink: { [key: string]: any },
      options: { [key: string]: any } | null
    ): Promise<any>;
  }

  interface GraphQLErrorObject {
    message: string;
    locations: {
      [index: number]: {
        line: number;
        column: number;
      }
    };
    extensions: {
      [key: string]: any;
    };
    [key: string]: any;
  }

  export function findGraphQLError(error: Error, find: (error: GraphQLErrorObject) => boolean): GraphQLErrorObject | null;
}
