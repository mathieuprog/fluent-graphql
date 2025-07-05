import FetchStrategy from '../execution/FetchStrategy';

export default class DocumentOptions {
  static defaultClient = null;
  static defaultFetchStrategy = FetchStrategy.FetchFromCacheOrFallbackNetwork;
  static maybeSimulateNetworkDelayGlobally = () => Promise.resolve(false);
  static getTenantsByTypename = (_typename) => [];
}
