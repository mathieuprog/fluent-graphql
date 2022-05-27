export default class NotFoundInCacheError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundInCacheError';
  }
}
