declare module 'fluent-graphql' {
  type PlainObject = { [key: string]: unknown };

  enum FetchStrategy {
    FetchFromCacheOrThrow = 'FETCH_FROM_CACHE_OR_THROW',
    FetchFromCacheOrFallbackNetwork = 'FETCH_FROM_CACHE_OR_FALLBACK_NETWORK',
    FetchFromCacheAndNetwork = 'FETCH_FROM_CACHE_AND_NETWORK',
    FetchFromNetwork = 'FETCH_FROM_NETWORK',
    FetchFromNetworkAndRecreateCache = 'FETCH_FROM_NETWORK_AND_RECREATE_CACHE',
    FetchFromNetworkAndSkipCaching = 'FETCH_FROM_NETWORK_AND_SKIP_CACHING',
    FetchFromNetworkAndSkipCachingAndCacheUpdate = 'FETCH_FROM_NETWORK_AND_SKIP_CACHING_AND_CACHE_UPDATE'
  }

  enum OperationType {
    Query = 'QUERY',
    Mutation = 'MUTATION',
    Subscription = 'SUBSCRIPTION'
  }

  enum LogLevel {
    None = 'NONE',
    Verbose = 'VERBOSE',
    Debug = 'DEBUG',
    Info = 'INFO',
    Warn = 'WARN'
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

  class Node<This, Parent, VariablesType> {
    _: Parent
    reference(name: string, referencedFieldOrTypename: string, typename?: string): Node<This, Parent, VariablesType>;
    scalar(name: string, transformer?: (v: string) => unknown, variables?: VariablesType): Node<This, Parent, VariablesType>;
    virtual(name: string, initialValue: unknown): Node<This, Parent, VariablesType>;
    entity(name: string, possibleTypenames?: string | string[]): Node<NestedNode<This, VariablesType>, This, VariablesType>;
    entitySet(name: string, possibleTypenames?: string | string[]): Node<NestedNode<This, VariablesType>, This, VariablesType>;
    union(name: string): Node<NestedNode<This, VariablesType>, This, VariablesType>;
    unionSet(name: string): Node<NestedNode<This, VariablesType>, This, VariablesType>;
    interface(name: string): Node<NestedNode<This, VariablesType>, This, VariablesType>;
    interfaceSet(name: string): Node<NestedNode<This, VariablesType>, This, VariablesType>;
    onEntity(typename: string): InlineFragment<This, VariablesType>;
    onTypedObject(typename: string): InlineFragment<This, VariablesType>;
    embed(name: string): Node<NestedNode<This, VariablesType>, This, VariablesType>;
    embedList(name: string): Node<NestedNode<This, VariablesType>, This, VariablesType>;
    viewer(name: string): Node<NestedNode<This, VariablesType>, This, VariablesType>;
    wrapper(name: string): Node<NestedNode<This, VariablesType>, This, VariablesType>;
    useVariables(variables: PlainObject): Node<This, Parent, VariablesType>;
    replaceEntity(filter: PlainObject): Node<This, Parent, VariablesType>;
    addEntity(filter: PlainObject): Node<This, Parent, VariablesType>;
    deriveFromReference(foreignKey: string, fetch: (foreignKey: string, variables: VariablesType, executionContext: any) => unknown): Node<This, Parent, VariablesType>;
    deriveFrom(fetch: (variables: VariablesType, executionContext: any) => unknown): Node<This, Parent, VariablesType>;
    replaceElements(): Node<This, Parent, VariablesType>;
    removeElements(): Node<This, Parent, VariablesType>;
    deleteAll(): Node<This, Parent, VariablesType>;
    delete(): Node<This, Parent, VariablesType>;
  }

  class NestedNode<Parent, VariablesType> extends Node<NestedNode<Parent, VariablesType>, Parent, VariablesType> {}

  class RootObject<ReturnType, VariablesType, TransformedType> extends Node<RootObject<ReturnType, VariablesType, TransformedType>, Document<ReturnType, VariablesType, TransformedType>, VariablesType> {
    variableDefinitions(variableDefinitions: { [K in keyof VariablesType]: string }): RootObject<ReturnType, VariablesType, TransformedType>;
  }

  class InlineFragment<Parent, VariablesType> extends Node<InlineFragment<Parent, VariablesType>, Parent, VariablesType> {}

  type Subscriber = (data: any) => void;
  type Unsubscriber = () => void;

  class Document<ReturnType, VariablesType, TransformedType = ReturnType> {
    operationType: OperationType;
    operationName: string;
    constructor(operationType: OperationType, operationName?: string)
    static query<ReturnType, VariablesType, TransformedType = ReturnType>(operationName?: string): RootObject<ReturnType, VariablesType, TransformedType>;
    static mutation<ReturnType, VariablesType, TransformedType = ReturnType>(operationName: string): RootObject<ReturnType, VariablesType, TransformedType>;
    static subscription<ReturnType, VariablesType, TransformedType = ReturnType>(operationName: string): RootObject<ReturnType, VariablesType, TransformedType>;
    static getByOperationName<ReturnType, VariablesType, TransformedType = ReturnType>(operationType: OperationType, operationName: string): RootObject<ReturnType, VariablesType, TransformedType>;
    static getOrCreateByOperationName<ReturnType, VariablesType, TransformedType = ReturnType>(operationType: OperationType, operationName: string): RootObject<ReturnType, VariablesType, TransformedType>;
    static setDefaultClient(client: Client): void;
    static setLogLevel(level: LogLevel): void;
    static simulateNetworkDelayGlobally(min: number, max: number): void;
    static defineTenantFields(fun: (typename: string) => string[]): void;
    static clearQueries(operationNames: string[]): void;
    static clearAllQueries(): void;
    simulateNetworkDelay(min: number, max: number): Document<ReturnType, VariablesType, TransformedType>;
    makeExecutable(client?: Client): Document<ReturnType, VariablesType, TransformedType>;
    execute(
      variables: VariablesType,
      options?: PlainObject
    ): Promise<TransformedType>;
    execute(
      variables: VariablesType,
      sink: PlainObject,
      options?: PlainObject
    ): Promise<TransformedType>;
    // execute_(variables: VariablesType): Executor);
    getQueryExecutor(variables: VariablesType): QueryExecutor<TransformedType, VariablesType>;
    simulateNetworkResponse(data: PlainObject): void;
    transformResponse(fun: (data: ReturnType) => unknown): Document<ReturnType, VariablesType, TransformedType>;
    setRefetchStrategy(fetchStrategy: FetchStrategy): Document<ReturnType, VariablesType, TransformedType>;
    filterEntity(fun: (entity: any, variables: VariablesType) => boolean): Document<ReturnType, VariablesType, TransformedType>;
    scopeByTenants(fun: (variables: VariablesType) => PlainObject): Document<ReturnType, VariablesType, TransformedType>;
    clearAfter(duration: any): Document<ReturnType, VariablesType, TransformedType>; // TODO Temporal type
    pollAfter(duration: any): Document<ReturnType, VariablesType, TransformedType>; // TODO Temporal type
    createExecutionContext(executionContextGetter: (variables: VariablesType, data: ReturnType) => unknown): Document<ReturnType, VariablesType, TransformedType>;
    clearQueries(): Document<ReturnType, VariablesType, TransformedType>;
    invalidateAllCaches(): Document<ReturnType, VariablesType, TransformedType>;
    getQueryString(): string;
    subscribe(variables: VariablesType, subscriber: Subscriber): Unsubscriber;
    afterExecution(fun: (data: TransformedType) => unknown): Document<ReturnType, VariablesType, TransformedType>;
  }

  class QueryExecutor<ReturnType, VariablesType = unknown, TransformedType = ReturnType> {
    document: Document<ReturnType, VariablesType, TransformedType>;
    variables: VariablesType;
    constructor(document: Document<ReturnType, VariablesType, TransformedType>, variables: VariablesType);
    execute(options?: PlainObject): Promise<TransformedType>;
    refetchQuery(): Promise<TransformedType>;
    subscribe(subscriber: Subscriber): Unsubscriber;
  }

  interface GraphQLErrorObject {
    message: string;
    locations?: Array<{ line: number; column: number }>;
    extensions?: PlainObject;
    [key: string]: unknown;
  }

  function findGraphQLError(error: Error, find: (error: GraphQLErrorObject) => boolean): GraphQLErrorObject | null;
  function findGraphQLErrorByCode(error: Error, code: string): GraphQLErrorObject | null;
  function mapNonNullish<T, U = unknown>(transformer: (v: U) => T): (v: unknown) => T | null;
}
