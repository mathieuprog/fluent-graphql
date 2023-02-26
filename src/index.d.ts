declare module "fluent-graphql" {
  type ObjectLiteral = { [key: string]: unknown };

  enum FetchStrategy {
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

  class Client {
    constructor(config: ClientConfig);
  }

  class NotFoundInCacheError extends Error {}

  class GraphQLError extends Error {}

  class Object<This, Parent> {
    _: Parent
    scalar(name: string, transformer?: (v: unknown) => unknown): Object<This, Parent>;
    entity(name: string): Object<NestedObject<This>, This>;
    entitySet(name: string): Object<NestedObject<This>, This>;
    union(name: string): Object<NestedObject<This>, This>;
    unionSet(name: string): Object<NestedObject<This>, This>;
    interface(name: string): Object<NestedObject<This>, This>;
    interfaceSet(name: string): Object<NestedObject<This>, This>;
    onEntity(typename: string): InlineFragment<This>;
    onTypedObject(typename: string): InlineFragment<This>;
    embed(name: string): Object<NestedObject<This>, This>;
    embedList(name: string): Object<NestedObject<This>, This>;
    viewer(name: string): Object<NestedObject<This>, This>;
    useVariables(variables: ObjectLiteral): Object<This, Parent>;
    replaceEntity(filter: ObjectLiteral): Object<This, Parent>;
    addEntity(filter: ObjectLiteral): Object<This, Parent>;
    deriveFromForeignKey(foreignKey: string, fetch: (foreignKey: string | number, variables: ObjectLiteral) => ObjectLiteral): Object<This, Parent>;
    deriveFrom(fetch: (variables: ObjectLiteral) => ObjectLiteral): Object<This, Parent>;
    overrideElements(): Object<This, Parent>;
    removeElements(): Object<This, Parent>;
    deleteElements(): Object<This, Parent>;
    delete(): Object<This, Parent>;
  }

  class NestedObject<Parent> extends Object<NestedObject<Parent>, Parent> {}

  class RootObject extends Object<RootObject, Document> {
    variableDefinitions(variableDefinitions: ObjectLiteral): RootObject;
  }

  class InlineFragment<Parent> extends Object<InlineFragment<Parent>, Parent> {}

  class Document {
    static query(operationName?: string): RootObject;
    static mutation(operationName: string): RootObject;
    static subscription(operationName: string): RootObject;
    static setDefaultClient(client: Client): void;
    static simulateNetworkDelayGlobally(min: number, max: number): void;
    simulateNetworkDelay(min: number, max: number): Document
    makeExecutable(client?: Client): Document;
    execute<T>(
      variables: ObjectLiteral,
      options?: ObjectLiteral
    ): Promise<T>;
    execute<T>(
      variables: ObjectLiteral,
      subscriber: (data: T) => void,
      returnUnsubscriber: (unsubscriber: () => void) => void,
      options?: ObjectLiteral
    ): Promise<T>;
    execute<T>(
      variables: ObjectLiteral,
      sink: ObjectLiteral,
      options?: ObjectLiteral
    ): Promise<T>;
    simulateNetworkRequest(data: ObjectLiteral): void;
    transformResponse(fun: (data: any) => unknown): Document
    clearAfter(duration: any): Document // TODO Temporal type
    pollAfter(duration: any): Document
    clear(): void;
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

  function findGraphQLError(error: Error, find: (error: GraphQLErrorObject) => boolean): GraphQLErrorObject | null;
}
