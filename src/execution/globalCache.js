import { areDataEqual, deepFreezePlain, differencePrimitives, makeCopyOnWriteObjectSetter, omitProperties, pickProperties } from 'object-array-utils';
import Logger from '../Logger';
import ObjectType from '../document/ObjectType';

export class GlobalCache {
  constructor() {
    this.entities = {};
    this.updateInProgress = false;
  }

  clear() {
    this.entities = {};
  }

  getById(id) {
    return this.entities[id];
  }

  update(freshEntities) {
    Logger.debug(() => `Updating global cache`);
    
    // Simple locking mechanism to prevent concurrent updates
    if (this.updateInProgress) {
      Logger.warn('Concurrent update detected - this should not happen with proper queue implementation');
    }
    
    this.updateInProgress = true;
    try {
      return this.doUpdate(freshEntities);
    } finally {
      this.updateInProgress = false;
    }
  }

  doUpdate(freshEntities, updatedEntities = []) {
    for (let freshEntity of freshEntities) {
      if (freshEntity.id in this.entities) {
        let entity = this.entities[freshEntity.id];
        const originalEntity = entity;
        const isEntityUpdated = (entity) => entity !== originalEntity;
        const entityUpdates = pickProperties(freshEntity, ['id', '__typename', '__meta']);

        const set = makeCopyOnWriteObjectSetter(entity);

        if (freshEntity.__meta.isToBeDeleted) {
          if (entity) {
            Logger.verbose(() => `Entity deleted ${JSON.stringify(entity, null, 2)}`);
            delete this.entities[freshEntity.id];
            updatedEntities.push({ entityUpdates: freshEntity, entity: freshEntity });
          }
          continue;
        }

        for (const propName of Object.keys(freshEntity)) {
          if (['id', '__typename', '__meta'].includes(propName)) {
            continue;
          }

          if (propName in freshEntity.__meta.objects) {
            switch (freshEntity.__meta.objects[propName].type) {
              case ObjectType.ViewerObject:
              case ObjectType.RootObject:
                throw new Error();

              case ObjectType.Wrapper:
                break;

              case ObjectType.Embed:
              case ObjectType.EmbedList:
                const opts = { unboxPrimitives: true, unorderedArrays: true, areNonPlainObjectsEqual: (a, b) => {
                  const errorMessage = 'Missing implementation for areNonPlainObjectsEqual';
                  console.error(errorMessage);
                  console.dir(a, { depth: null });
                  console.dir(b, { depth: null });
                  throw new Error(errorMessage);
                } };
                if (areDataEqual(entity[propName], freshEntity[propName], opts)) {
                  continue;
                }
                Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)} (1)`);
                entity = set(propName, freshEntity[propName]);
                entityUpdates[propName] = freshEntity[propName];
                break;

              case ObjectType.Entity:
              case ObjectType.Union:
              case ObjectType.Interface:
                if (freshEntity.__meta.objects[propName].isToBeDeleted) {
                  if (entity[propName]) {
                    Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)} (2)`);
                    entity = set(propName, null);
                    entityUpdates[propName] = null;
                  }
                  continue;
                }

                if (entity[propName]?.id === freshEntity[propName]?.id) {
                  continue;
                }

                if (freshEntity[propName] === null) {
                  Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)} (3)`);
                  entity = set(propName, null);
                  entityUpdates[propName] = null;
                  continue;
                }

                Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)} (4)`);
                entity = set(propName, { id: freshEntity[propName].id });
                entityUpdates[propName] = freshEntity[propName];
                break;

              case ObjectType.EntitySet:
              case ObjectType.UnionSet:
              case ObjectType.InterfaceSet:
                if (propName in entity === false) {
                  entity = set(propName, freshEntity[propName].map(({ id }) => ({ id })));
                  entityUpdates[propName] = freshEntity[propName];
                  continue;
                }

                const cachedIds = entity[propName].map(({ id }) => id);
                const freshIds = freshEntity[propName].map(({ id }) => id);

                if (differencePrimitives(cachedIds, freshIds).length === 0) {
                  continue;
                }

                if (freshIds.length === 0) {
                  if (freshEntity.__meta.objects[propName].areElementsToBeReplaced) {
                    Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)} (5)`);
                    entity = set(propName, []);
                    entityUpdates[propName] = [];
                  }
                  continue;
                }

                if (freshEntity.__meta.objects[propName].areElementsToBeRemoved) {
                  const filteredEntities = entity[propName].filter(({ id }) => !freshIds.includes(id));
                  if (filteredEntities.length !== cachedIds.length) {
                    Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)} (6)`);
                    entityUpdates[propName] = freshEntity[propName].filter(({ id }) => cachedIds.includes(id));
                    entity = set(propName, filteredEntities.map(({ id }) => ({ id })));
                  }
                  continue;
                }

                const entitiesToBeAdded = freshEntity[propName].filter((entity) => !cachedIds.includes(entity.id));

                if (freshEntity.__meta.objects[propName].areElementsToBeReplaced) {
                  const filteredEntities = entity[propName].filter(({ id }) => freshIds.includes(id));
                  if (filteredEntities.length !== cachedIds.length || entitiesToBeAdded.length > 0) {
                    Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)} (7)`);
                    entity = set(propName, filteredEntities.concat(entitiesToBeAdded.map(({ id }) => ({ id }))));
                    entityUpdates[propName] = freshEntity[propName];
                  }
                  continue;
                }

                if (entitiesToBeAdded.length > 0) {
                  Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)} (8)`);
                  entity = set(propName, entity[propName].concat(entitiesToBeAdded.map(({ id }) => ({ id }))));
                  entityUpdates[propName] = entitiesToBeAdded;
                }
                break;
            }
          } else if (propName in freshEntity.__meta.scalars) {
            const opts = { unboxPrimitives: true, unorderedArrays: true, areNonPlainObjectsEqual: (a, b) => {
              const errorMessage = 'Missing implementation for areNonPlainObjectsEqual';
              console.error(errorMessage);
              console.dir(a, { depth: null });
              console.dir(b, { depth: null });
              throw new Error(errorMessage);
            } };
            if (propName in entity === false || !areDataEqual(entity[propName], freshEntity[propName], opts)) {
              Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)} (9)`);
              entity = set(propName, freshEntity[propName]);
              entityUpdates[propName] = freshEntity[propName];
            }
          }
        }

        if (isEntityUpdated(entity)) {
          updatedEntities.push({ entityUpdates, entity: freshEntity });
          this.entities[freshEntity.id] = deepFreezePlain(entity);
          Logger.verbose(() => `Cached entity has been updated with ${JSON.stringify(omitProperties(entityUpdates, ['__meta']), null, 2)}`);
        } else {
          Logger.verbose(() => `Received entity matches cached version: ${JSON.stringify(omitProperties(freshEntity, ['__meta']), null, 2)}`);
        }
      } else {
        updatedEntities.push({ entityUpdates: freshEntity, entity: freshEntity });
        this.entities[freshEntity.id] = omitProperties(freshEntity, ['__meta']);
        Logger.verbose(() => `New entity: ${JSON.stringify(omitProperties(freshEntity, ['__meta']), null, 2)}`);
      }
    }

    return updatedEntities;
  }
}

export default new GlobalCache();
