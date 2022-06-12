import FetchStrategy from './FetchStrategy';
import NotFoundInCacheError from '../errors/NotFoundInCacheError';

export default function getFetchStrategyAlgorithm(strategy) {
  return async ({ cached, fetchData, cacheData }) => {
    switch (strategy) {
      default:
        throw new Error(`unknown strategy ${strategy}`);

      case FetchStrategy.FETCH_FROM_CACHE_OR_FALLBACK_NETWORK:
        if (!cached) {
          await cacheData(await fetchData());
        }
        break;

      case FetchStrategy.FETCH_FROM_CACHE_AND_NETWORK:
        if (!cached) {
          await cacheData(await fetchData());
        } else {
          fetchData().then(cacheData);
        }
        break;

      case FetchStrategy.FETCH_FROM_NETWORK:
        await cacheData(await fetchData());
        break;

      case FetchStrategy.FETCH_FROM_CACHE_OR_THROW:
        if (!cached) {
          throw new NotFoundInCacheError('not found in cache');
        }
        break;
    }
  }
}
