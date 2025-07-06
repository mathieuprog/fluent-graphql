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

      case 'FETCH_FROM_NETWORK_AND_RECREATE_CACHE':
        return 'network and recreate cache';

      case 'FETCH_FROM_NETWORK_AND_SKIP_CACHING':
        return 'network only and skip caching';

      case 'FETCH_FROM_NETWORK_AND_SKIP_CACHING_AND_CACHE_UPDATE':
        return 'network only and skip caching and cache update';
    }
  },
  ...Object.freeze({
    FetchFromCacheOrThrow: 'FETCH_FROM_CACHE_OR_THROW',
    FetchFromCacheOrFallbackNetwork: 'FETCH_FROM_CACHE_OR_FALLBACK_NETWORK',
    FetchFromCacheAndNetwork: 'FETCH_FROM_CACHE_AND_NETWORK',
    FetchFromNetwork: 'FETCH_FROM_NETWORK',
    FetchFromNetworkAndRecreateCache: 'FETCH_FROM_NETWORK_AND_RECREATE_CACHE',
    FetchFromNetworkAndSkipCaching: 'FETCH_FROM_NETWORK_AND_SKIP_CACHING',
    FetchFromNetworkAndSkipCachingAndCacheUpdate: 'FETCH_FROM_NETWORK_AND_SKIP_CACHING_AND_CACHE_UPDATE'
  })
};
