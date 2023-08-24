export default {
  toString: function(fetchStrategy) {
    switch(fetchStrategy) {
      case 'FETCH_FROM_CACHE_OR_THROW':
        return 'cache only';

      case 'FETCH_FROM_CACHE_OR_FALLBACK_NETWORK':
        return 'cache or network';

      case 'FETCH_FROM_CACHE_AND_NETWORK':
        return 'cache and network';

      case 'FETCH_FROM_NETWORK':
        return 'network only';

      case 'FETCH_FROM_NETWORK_AND_NO_CACHE':
        return 'network only and no caching';
    }
  },
  ...Object.freeze({
    FetchFromCacheOrThrow: 'FETCH_FROM_CACHE_OR_THROW',
    FetchFromCacheOrFallbackNetwork: 'FETCH_FROM_CACHE_OR_FALLBACK_NETWORK',
    FetchFromCacheAndNetwork: 'FETCH_FROM_CACHE_AND_NETWORK',
    FetchFromNetwork: 'FETCH_FROM_NETWORK',
    FetchFromNetworkAndRecreateCache: 'FETCH_FROM_NETWORK_AND_RECREATE_CACHE',
    FetchFromNetworkAndNoCache: 'FETCH_FROM_NETWORK_AND_NO_CACHE',
    FetchFromNetworkAndNoCacheNoCacheUpdates: 'FETCH_FROM_NETWORK_AND_NO_CACHE_NO_CACHE_UPDATES'
  })
};
