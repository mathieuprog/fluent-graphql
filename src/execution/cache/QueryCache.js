import { deepFreezePlain, isPlainObject, makeCopyOnWriteObjectSetter } from 'object-array-utils';
import Logger from '../../Logger';
import ObjectType from '../../document/ObjectType';
import { throwIfNotInstanceOfDocument } from '../helpers';
import copyEntity from './copyEntity';
import refreshEntity from './refreshEntity';

export default class QueryCache {
  constructor(document, data, variables) {
    throwIfNotInstanceOfDocument(document);
    this.document = document;
    this.data = deepFreezePlain(data);
    this.transformedData = document.transform(data);
    this.variables = variables;
    this.isStale = false;
    Logger.info(() => `Cached response for operation ${document.operationName} with vars ${JSON.stringify(variables, null, 2)}`);
  }

  getData() {
    return this.transformedData;
  }

  markStale() {
    this.isStale = true;
  }

  markFresh() {
    this.isStale = false;
  }

  isStale() {
    return this.isStale;
  }

  update(updates) {
    Logger.debug(() => `Updating ${this.document.operationName} cache with vars ${JSON.stringify(this.variables, null, 2)}`);

    const prevData = this.data;

    this.data = this.doUpdate(this.data, this.document.rootObject, updates);

    this.transformedData = this.document.transform(this.data);

    const updated = prevData !== this.data;

    if (updated) {
      Logger.info(() => `Updated ${this.document.operationName} cache with vars ${JSON.stringify(this.variables, null, 2)}`);
    } else {
      Logger.debug(() => `Nothing to update for ${this.document.operationName} cache with vars ${JSON.stringify(this.variables, null, 2)}`);
    }

    return updated;
  }

  doUpdate(data, meta, updates) {
    if (!isPlainObject(data)) {
      throw new Error();
    }

    const set = makeCopyOnWriteObjectSetter(data);

    const objects =
      (data.__typename && meta.inlineFragments[data.__typename])
      ? { ...meta.objects, ...meta.inlineFragments[data.__typename].objects }
      : meta.objects;

    for (const [propName, object] of Object.entries(objects)) {
      if (propName in data === false) {
        throw new Error(`prop name "${propName}" not in ${JSON.stringify(data)}`);
      }

      switch (object.type) {
        case ObjectType.ViewerObject:
        case ObjectType.Wrapper:
          const transformedData = this.doUpdate(data[propName], object, updates);
          if (data[propName] !== transformedData) {
            data = set(propName, transformedData);
          }
          break;

        case ObjectType.Entity:
        case ObjectType.Union:
        case ObjectType.Interface:
          let addedEntity = false;
          if (object.addEntityFiltersByTypename) {
            for (let { entityUpdates, entity } of updates) {
              if (
                data[propName]?.id !== entity.id
                && object.addEntityFiltersByTypename[entity.__typename]?.(entity, this.variables, data)
              ) {
                data = set(propName, copyEntity(object, entityUpdates));
                addedEntity = true;
                break;
              }
            }
          }

          if (!addedEntity) {
            if (data[propName] !== null) {
              const transformedData = refreshEntity(data[propName], object, updates, this.variables);
              if (data[propName] !== transformedData) {
                data = set(propName, transformedData);
              }
            }

            if (data[propName] !== null) {
              const transformedData = this.doUpdate(data[propName], object, updates);
              if (data[propName] !== transformedData) {
                data = set(propName, transformedData);
              }
            }
          }
          break;

        case ObjectType.EntitySet:
        case ObjectType.UnionSet:
        case ObjectType.InterfaceSet:
          let updated = false;
          const newData =
            data[propName]
              .map((entity) => {
                const transformedData = refreshEntity(entity, object, updates, this.variables);
                updated = updated || (transformedData !== entity);
                return transformedData;
              })
              .filter((entity) => entity)
              .map((entity) => {
                const transformedData = this.doUpdate(entity, object, updates);
                updated = updated || (transformedData !== entity);
                return transformedData;
              });

          if (updated) {
            data = set(propName, newData);
          }

          if (object.addEntityFiltersByTypename) {
            for (let { entityUpdates, entity } of updates) {
              if (
                !entity.__meta.isToBeDeleted
                && !data[propName].some(({ id }) => id === entity.id)
                && object.addEntityFiltersByTypename[entity.__typename]?.(entity, this.variables, data)
              ) {
                const entityToAdd = copyEntity(object, entityUpdates);
                data = set(propName, data[propName].concat(entityToAdd));
              }
            }
          }
          break;
      }
    }

    return deepFreezePlain(data);
  }
}
