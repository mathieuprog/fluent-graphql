declare module "fluent-graphql" {
  type ObjectLiteral = { [key: string]: unknown };

  export enum FetchStrategy {
    FetchFromCacheOrThrow = "FETCH_FROM_CACHE_OR_THROW",
    FetchFromCacheOrFallbackNetwork = "FETCH_FROM_CACHE_OR_FALLBACK_NETWORK",
    FetchFromCacheAndNetwork = "FETCH_FROM_CACHE_AND_NETWORK",
    FetchFromNetwork = "FETCH_FROM_NETWORK",
  }

  interface ClientConfig {
    http: HttpClient;
    ws: WsClient;
  }

  interface HttpClient {
    url: string;
    [key: string]: unknown;
  }

  interface WsClient {
    url: string;
    [key: string]: unknown;
  }

  export class Client {
    constructor(config: ClientConfig);
  }

  export class NotFoundInCacheError extends Error {}

  export class GraphQLError extends Error {}

  export class Object {
    _: Object | RootObject | InlineFragment | Document
    scalar(name: string, transformer?: (v: unknown) => unknown): Object;
    entity(name: string): Object;
    entitySet(name: string): Object;
    union(name: string): Object;
    unionList(name: string): Object;
    embedUnion(name: string): Object;
    embedUnionList(name: string): Object;
    interface(name: string): Object;
    interfaceSet(name: string): Object;
    onEntity(typename: string): InlineFragment;
    onTypedObject(typename: string): InlineFragment;
    embed(name: string): Object;
    embedList(name: string): Object;
    viewer(name: string): Object;
    useVariables(variables: ObjectLiteral): Object;
    replaceEntity(filter: ObjectLiteral): Object;
    filterEntity(filter: ObjectLiteral): Object;
    deriveFromForeignKey(foreignKey: string, fetch: (foreignKey: string | number, variables: ObjectLiteral) => ObjectLiteral): Object;
    deriveFrom(fetch: (variables: ObjectLiteral) => ObjectLiteral): Object;
    overrideElements(): Object;
    removeElements(): Object;
    deleteElements(): Object;
    delete(): Object;
  }

  export class RootObject extends Object {
    variableDefinitions(variableDefinitions: ObjectLiteral): RootObject;
  }

  export class InlineFragment extends Object {}

  export class Document {
    static query(operationName: string | null): RootObject;
    static mutation(operationName: string): RootObject;
    static subscription(operationName: string): RootObject;
    static setDefaultClient(client: Client): void;
    makeExecutable(client: Client | null): Document;
    execute(
      variables: ObjectLiteral,
      options?: ObjectLiteral
    ): Promise<unknown>;
    execute(
      variables: ObjectLiteral,
      subscriber: (data: ObjectLiteral) => void,
      returnUnsubscriber: (unsubscriber: () => void) => void,
      options?: ObjectLiteral | null
    ): Promise<unknown>;
    execute(
      variables: ObjectLiteral,
      sink: ObjectLiteral,
      options?: ObjectLiteral | null
    ): Promise<unknown>;
    transformResponse(fun: (data: unknown) => unknown): Document
    clearAfter(duration: any): Document
    pollAfter(duration: any): Document
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
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }

  export function findGraphQLError(error: Error, find: (error: GraphQLErrorObject) => boolean): GraphQLErrorObject | null;
}
