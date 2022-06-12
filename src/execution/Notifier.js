import { isEmptyObjectLiteral } from 'object-array-utils';

export default class Notifier {
  static subscribers = new Set();

  static subscribe(subscriber) {
    const item = { subscriber };

    this.subscribers.add(item);

    return () => {
      this.subscribers.delete(item);
    };
  }

  static notify(data, metadata = null) {
    if (isEmptyObjectLiteral(data)) {
      return;
    }

    for (const { subscriber } of Notifier.subscribers) {
      subscriber.updateCache(data, metadata);
    }
  }
}
