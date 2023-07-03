import { isArray, isEmptyArray, isEmptyObjectLiteral } from 'object-array-utils';
import Logger from '../Logger';

export default class Notifier {
  static subscribers = new Set();

  static subscribe(subscriber) {
    const item = { subscriber };

    this.subscribers.add(item);

    return () => {
      this.subscribers.delete(item);
    };
  }

  static notify(entities) {
    if (!isArray(entities)) {
      throw new Error();
    }

    Logger.verbose(() => {
      const entitiesWithoutMeta = [...entities].map((entity) => {
        const { __meta, ...entityWithoutMeta } = entity;
        return entityWithoutMeta;
      });
      return `Notifying ${Notifier.subscribers.size} subscribers with new entities: ${JSON.stringify(entitiesWithoutMeta, null, 2)}`;
    });

    if (isEmptyArray(entities)) {
      return;
    }

    for (const { subscriber } of Notifier.subscribers) {
      subscriber.updateCache(entities);
    }
  }
}
