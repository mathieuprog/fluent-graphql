import Document from '../document/Document';
import RootObject from '../document/RootObject';

export function throwIfNotInstanceOfDocument(document) {
  if (document instanceof Document === false) {
    if (document instanceof RootObject) {
      throw new Error('Access _ once more to return the document object');
    }
    throw new Error();
  }
}
