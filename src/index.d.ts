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

  class Node<This, Parent> {
    _: Parent
    scalar(name: string, transformer?: (v: unknown) => unknown): Node<This, Parent>;
    entity(name: string): Node<NestedNode<This>, This>;
    entitySet(name: string): Node<NestedNode<This>, This>;
    union(name: string): Node<NestedNode<This>, This>;
    unionSet(name: string): Node<NestedNode<This>, This>;
    interface(name: string): Node<NestedNode<This>, This>;
    interfaceSet(name: string): Node<NestedNode<This>, This>;
    onEntity(typename: string): InlineFragment<This>;
    onTypedObject(typename: string): InlineFragment<This>;
    embed(name: string): Node<NestedNode<This>, This>;
    embedList(name: string): Node<NestedNode<This>, This>;
    viewer(name: string): Node<NestedNode<This>, This>;
    useVariables(variables: ObjectLiteral): Node<This, Parent>;
    replaceEntity(filter: ObjectLiteral): Node<This, Parent>;
    addEntity(filter: ObjectLiteral): Node<This, Parent>;
    deriveFromForeignKey(foreignKey: string, fetch: (foreignKey: string | number, variables: ObjectLiteral) => ObjectLiteral): Node<This, Parent>;
    deriveFrom(fetch: (variables: ObjectLiteral) => ObjectLiteral): Node<This, Parent>;
    overrideElements(): Node<This, Parent>;
    removeElements(): Node<This, Parent>;
    deleteElements(): Node<This, Parent>;
    delete(): Node<This, Parent>;
  }

  class NestedNode<Parent> extends Node<NestedNode<Parent>, Parent> {}

  class RootObject extends Node<RootObject, Document> {
    variableDefinitions(variableDefinitions: ObjectLiteral): RootObject;
  }

  class InlineFragment<Parent> extends Node<InlineFragment<Parent>, Parent> {}

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
    getQueryString(): string;
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
  function findGraphQLErrorByCode(error: Error, code: string): GraphQLErrorObject | null;
}
