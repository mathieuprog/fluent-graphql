import RootObject from '../document/RootObject';

export function throwIfNotInstanceOfDocument(instance) {
  if (!instance.operationType) {
    if (instance instanceof RootObject) {
      throw new Error('Access _ once more to return the document object');
    }
    throw new Error();
  }
}
