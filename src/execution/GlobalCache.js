import { areValuesEqual, filterProperties, isEmptyArray, rejectProperties } from 'object-array-utils';
import ObjectType from '../document/ObjectType';
import Logger from '../Logger';

const updatePropImmutablyFun = ((original) => {
  let data = original;
  return (prop, value) => {
    data = (original === data) ? { ...data } : data;
    data[prop] = value;
    return data;
  };
});

export default class GlobalCache {
  entities = {};

  getById(id) {
    return this.entities[id];
  }

  update(freshEntities) {
    Logger.debug(() => `Updating global cache`);
    return this.doUpdate(freshEntities);
  }

  doUpdate(freshEntities, updatedEntities = []) {
    for (let freshEntity of freshEntities) {
      if (freshEntity.id in this.entities) {
        let entity = this.entities[freshEntity.id];
        const originalEntity = entity;
        const isEntityUpdated = (entity) => entity !== originalEntity;
        const entityUpdates = filterProperties(freshEntity, ['id', '__typename', '__meta']);

        const updatePropImmutably = updatePropImmutablyFun(entity);

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
                if (areValuesEqual(entity[propName], freshEntity[propName])) {
                  continue;
                }
                Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)}`);
                entity = updatePropImmutably(propName, freshEntity[propName]);
                entityUpdates[propName] = freshEntity[propName];
                break;

              case ObjectType.Entity:
              case ObjectType.Union:
              case ObjectType.Interface:
                if (entity[propName]?.id === freshEntity[propName]?.id) {
                  continue;
                }

                if (freshEntity[propName] === null) {
                  Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)}`);
                  entity = updatePropImmutably(propName, null);
                  entityUpdates[propName] = null;
                  continue;
                }

                Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)}`);
                entity = updatePropImmutably(propName, { id: freshEntity[propName].id });
                entityUpdates[propName] = freshEntity[propName];
                break;

              case ObjectType.EntitySet:
              case ObjectType.UnionSet:
              case ObjectType.InterfaceSet:
                if (propName in entity === false) {
                  entity = updatePropImmutably(propName, freshEntity[propName].map(({ id }) => ({ id })));
                  entityUpdates[propName] = freshEntity[propName];
                  continue;
                }

                const cachedIds = entity[propName].map(({ id }) => id);
                const freshIds = freshEntity[propName].map(({ id }) => id);

                if (areValuesEqual(cachedIds, freshIds)) {
                  continue;
                }

                if (isEmptyArray(freshIds)) {
                  if (freshEntity.__meta.objects[propName].areElementsToBeOverridden) {
                    Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)}`);
                    entity = updatePropImmutably(propName, []);
                    entityUpdates[propName] = [];
                  }
                  continue;
                }

                if (freshEntity.__meta.objects[propName].areElementsToBeRemoved) {
                  const filteredEntities = entity[propName].filter(({ id }) => !freshIds.includes(id));
                  if (filteredEntities.length !== cachedIds.length) {
                    Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)}`);
                    entityUpdates[propName] = freshEntity[propName].filter(({ id }) => cachedIds.includes(id));
                    entity = updatePropImmutably(propName, filteredEntities.map(({ id }) => ({ id })));
                  }
                  continue;
                }

                const entitiesToBeAdded = freshEntity[propName].filter((entity) => !cachedIds.includes(entity.id));

                if (freshEntity.__meta.objects[propName].areElementsToBeOverridden) {
                  const filteredEntities = entity[propName].filter(({ id }) => freshIds.includes(id));
                  if (filteredEntities.length !== cachedIds.length || entitiesToBeAdded.length > 0) {
                    Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)}`);
                    entity = updatePropImmutably(propName, filteredEntities.concat(entitiesToBeAdded.map(({ id }) => ({ id }))));
                    entityUpdates[propName] = freshEntity[propName];
                  }
                  continue;
                }

                if (entitiesToBeAdded.length > 0) {
                  Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)}`);
                  entity = updatePropImmutably(propName, entity[propName].concat(entitiesToBeAdded.map(({ id }) => ({ id }))));
                  entityUpdates[propName] = entitiesToBeAdded;
                }
                break;
            }
          } else if (propName in freshEntity.__meta.scalars) {
            if (propName in entity === false || !areValuesEqual(entity[propName], freshEntity[propName])) {
              Logger.verbose(() => `Property ${propName} updated on entity ${JSON.stringify(entity, null, 2)}`);
              entity = updatePropImmutably(propName, freshEntity[propName]);
              entityUpdates[propName] = freshEntity[propName];
            }
          }
        }

        if (isEntityUpdated(entity)) {
          updatedEntities.push({ entityUpdates, entity: freshEntity });
          this.entities[freshEntity.id] = entity;
          Logger.verbose(() => `Cached entity has been updated with ${JSON.stringify(rejectProperties(entityUpdates, ['__meta']), null, 2)}`);
        } else {
          Logger.verbose(() => `Received entity matches cached version: ${JSON.stringify(rejectProperties(freshEntity, ['__meta']), null, 2)}`);
        }
      } else {
        updatedEntities.push({ entityUpdates: freshEntity, entity: freshEntity });
        this.entities[freshEntity.id] = rejectProperties(freshEntity, ['__meta']);
        Logger.verbose(() => `New entity: ${JSON.stringify(rejectProperties(freshEntity, ['__meta']), null, 2)}`);
      }
    }

    return updatedEntities;
  }
}
