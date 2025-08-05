import { isPlainObject, makeCopyOnWriteObjectSetter } from 'object-array-utils';
import Logger from '../../Logger';
import ObjectType from '../../document/ObjectType';
import { throwIfNotInstanceOfDocument } from '../helpers';
import copyEntity from './copyEntity';
import refreshEntity from './refreshEntity';

export default class QueryCache {
  constructor(document, data, variables) {
    throwIfNotInstanceOfDocument(document);
    this.document = document;
    this.data = data; // Already transformed by OperationExecutor
    this.variables = variables;
    this.isStaleFlag = false;
    this.entityIds = this.collectEntityIds(data, document.rootObject);
    this.hasAddCallbacks = this.hasAddOrReplaceCallbacks(document.rootObject);
    this.addTypenames = this.hasAddCallbacks ? this.collectAddTypenames(document.rootObject) : new Set();
    Logger.info(() => `Cached response for operation ${document.operationName} with vars ${JSON.stringify(variables, null, 2)}`);
  }

  getData() {
    return this.data;
  }

  markStale() {
    this.isStaleFlag = true;
  }

  markFresh() {
    this.isStaleFlag = false;
  }

  isStale() {
    return this.isStaleFlag;
  }

  update(updates) {
    Logger.debug(() => `Updating ${this.document.operationName} cache with vars ${JSON.stringify(this.variables, null, 2)}`);

    // Filter updates based on relevance
    let relevantUpdates;
    if (!this.hasAddCallbacks) {
      // Fast path: only updates to existing entities
      relevantUpdates = updates.filter(({ entity }) => this.entityIds.has(entity.id));
    } else {
      // Typename-aware filtering for queries with add callbacks
      relevantUpdates = updates.filter(({ entity }) => 
        this.entityIds.has(entity.id) || // Updates to existing entities
        this.addTypenames.has(entity.__typename) // Potential adds of matching types
      );
    }

    if (relevantUpdates.length === 0) {
      Logger.debug(() => `No relevant updates for ${this.document.operationName} cache`);
      return false;
    }

    const prevData = this.data;

    this.data = this.doUpdate(this.data, this.document.rootObject, relevantUpdates);

    const updated = prevData !== this.data;

    if (updated) {
      this.entityIds = this.collectEntityIds(this.data, this.document.rootObject);
      // No need to update addTypenames - they're static based on the document structure
      Logger.info(() => `Updated ${this.document.operationName} cache with vars ${JSON.stringify(this.variables, null, 2)}`);
    } else {
      Logger.debug(() => `Nothing to update for ${this.document.operationName} cache with vars ${JSON.stringify(this.variables, null, 2)}`);
    }

    return updated;
  }

  doUpdate(data, meta, updates) {
    if (!isPlainObject(data)) {
      throw new Error(`Expected plain object for ${meta.name} in cache update (document: ${this.document.operationName})`);
    }

    const set = makeCopyOnWriteObjectSetter(data);

    const objects =
      (data.__typename && meta.inlineFragments[data.__typename])
      ? { ...meta.objects, ...meta.inlineFragments[data.__typename].objects }
      : meta.objects;

    for (const [propName, object] of Object.entries(objects)) {
      if (propName in data === false) {
        throw new Error(`Missing required property '${propName}' in ${meta.name} during cache update (document: ${this.document.operationName})`);
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
          const newData = [];
          
          // Single loop that combines refresh and update
          for (const entity of data[propName]) {
            let transformedEntity = refreshEntity(entity, object, updates, this.variables);
            if (transformedEntity) {
              transformedEntity = this.doUpdate(transformedEntity, object, updates);
              newData.push(transformedEntity);
              updated = updated || (transformedEntity !== entity);
            }
          }

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

    return data; // Don't freeze during update - only freeze final output
  }

  hasAddOrReplaceCallbacks(meta) {
    // Check if any object in the meta tree has add or replace callbacks
    for (const object of Object.values(meta.objects)) {
      if (object.addEntityFiltersByTypename || object.replaceEntityFiltersByTypename) {
        return true;
      }
      if (object.objects && this.hasAddOrReplaceCallbacks(object)) {
        return true;
      }
    }
    
    // Check inline fragments
    if (meta.inlineFragments) {
      for (const fragment of Object.values(meta.inlineFragments)) {
        if (this.hasAddOrReplaceCallbacks(fragment)) {
          return true;
        }
      }
    }
    
    return false;
  }

  collectAddTypenames(meta) {
    const typenames = new Set();
    this.doCollectAddTypenames(meta, typenames);
    return typenames;
  }

  doCollectAddTypenames(meta, typenames) {
    // Collect typenames from add/replace callbacks
    for (const object of Object.values(meta.objects || {})) {
      if (object.addEntityFiltersByTypename) {
        for (const typename of Object.keys(object.addEntityFiltersByTypename)) {
          typenames.add(typename);
        }
      }
      if (object.replaceEntityFiltersByTypename) {
        for (const typename of Object.keys(object.replaceEntityFiltersByTypename)) {
          typenames.add(typename);
        }
      }
      if (object.objects) {
        this.doCollectAddTypenames(object, typenames);
      }
    }
    
    // Check inline fragments
    if (meta.inlineFragments) {
      for (const fragment of Object.values(meta.inlineFragments)) {
        this.doCollectAddTypenames(fragment, typenames);
      }
    }
  }

  collectEntityIds(data, meta) {
    const ids = new Set();
    this.doCollectEntityIds(data, meta, ids);
    return ids;
  }

  doCollectEntityIds(data, meta, ids) {
    if (!isPlainObject(data)) {
      return;
    }

    // Add the entity's own ID if it has one
    if (data.id && data.__typename) {
      ids.add(data.id);
    }

    const objects =
      (data.__typename && meta.inlineFragments[data.__typename])
      ? { ...meta.objects, ...meta.inlineFragments[data.__typename].objects }
      : meta.objects;

    for (const [propName, object] of Object.entries(objects)) {
      if (propName in data === false || data[propName] === null) {
        continue;
      }

      switch (object.type) {
        case ObjectType.ViewerObject:
        case ObjectType.Wrapper:
          this.doCollectEntityIds(data[propName], object, ids);
          break;

        case ObjectType.Entity:
        case ObjectType.Union:
        case ObjectType.Interface:
          if (data[propName]?.id) {
            ids.add(data[propName].id);
          }
          if (data[propName] !== null) {
            this.doCollectEntityIds(data[propName], object, ids);
          }
          break;

        case ObjectType.EntitySet:
        case ObjectType.UnionSet:
        case ObjectType.InterfaceSet:
          for (const item of data[propName]) {
            if (item.id) {
              ids.add(item.id);
            }
            this.doCollectEntityIds(item, object, ids);
          }
          break;

        case ObjectType.EmbedList:
          for (const item of data[propName]) {
            this.doCollectEntityIds(item, object, ids);
          }
          break;
      }
    }
  }
}
