import { isArray, isEmptyArray } from 'object-array-utils';
import Logger from '../Logger';

export default class Notifier {
  static subscribers = new Set();

  static subscribe(subscriber) {
    const item = { subscriber };

    this.subscribers.add(item);
    Logger.info(`Added subscriber query for data updates. Total subscriber count: ${this.subscribers.size}`);

    return () => {
      this.subscribers.delete(item);
      Logger.info(`Removed subscriber query from data updates. Total subscriber count: ${this.subscribers.size}`);
    };
  }

  static notify(entries) {
    if (!isArray(entries)) {
      throw new Error();
    }

    Logger.info(`Notifying ${Notifier.subscribers.size} subscribed queries with fetched entities`);
    Logger.verbose(() => {
      const entitiesWithoutMeta = [...entries].map(({ entity }) => {
        const { __meta, ...entityWithoutMeta } = entity;
        return entityWithoutMeta;
      });
      return `Fetched entities: ${JSON.stringify(entitiesWithoutMeta, null, 2)}`;
    });

    if (isEmptyArray(entries)) {
      return;
    }

    for (const { subscriber } of Notifier.subscribers) {
      subscriber.updateCache(entries);
    }
  }
}
