import RootObject from '../document/RootObject';

export function mapNonNullish(transformer) {
  if (typeof transformer !== 'function') {
    throw new Error('mapNonNullish(transformer) should receive a function as argument');
  }

  return (value) => value == null ? value : transformer(value);
}

export function throwIfNotInstanceOfDocument(instance) {
  if (!instance.operationType) {
    if (instance instanceof RootObject) {
      throw new Error('Access _ once more to return the document object');
    }
    throw new Error();
  }
}
