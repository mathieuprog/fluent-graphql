import {
  areValuesEqual,
  filterProperties,
  isEmptyArray,
  isObjectLiteral
} from 'object-array-utils';
import ObjectType from '../document/ObjectType';
import { checkInstanceOfDocumentArg } from './helpers';

export default class QueryCache {
  constructor(document, data, variables) {
    checkInstanceOfDocumentArg(document);
    this.document = document;
    this.data = data;
    this.transformedData = document.transform(data);
    this.variables = variables;
  }

  update(updates) {
    const updated = this.doUpdate(updates, this.data, this.document.rootObject);

    this.transformedData = this.document.transform(this.data);

    return updated;
  }

  doUpdate(updates, data, meta, updated = false) {
    if (!isObjectLiteral(data)) {
      throw new Error();
    }

    const objects =
      (data.__typename && meta.inlineFragments[data.__typename])
      ? { ...meta.objects, ...meta.inlineFragments[data.__typename].objects }
      : meta.objects;

    for (const [propName, object] of Object.entries(objects)) {
      if (propName in data === false) {
        throw new Error();
      }

      switch (object.type) {
        case ObjectType.VIEWER_OBJECT:
          updated = this.doUpdate(updates, data[propName], object, updated);
          break;

        case ObjectType.ENTITY:
        case ObjectType.UNION:
        case ObjectType.INTERFACE:
          if (object.filter) {
            for (let updatedEntity of updates) {
              if (
                data[propName]?.id !== updatedEntity.id
                && object.filter[updatedEntity.__typename]?.(updatedEntity, this.variables)
              ) {
                updated = true;
                data[propName] = this.addEntity(object, updatedEntity);
              }
            }
          }

          if (data[propName] !== null) {
            const { entity, updated: updated_ } = this.updateEntity(data[propName], object, updates);
            data[propName] = entity;
            updated = updated || updated_;
          }

          if (data[propName] !== null) {
            updated = this.doUpdate(updates, data[propName], object, updated);
          }
          break;

        case ObjectType.ENTITY_SET:
        case ObjectType.UNION_LIST:
        case ObjectType.INTERFACE_SET:
          if (object.filter) {
            for (let updatedEntity of updates) {
              if (
                !data[propName].some(({ id }) => id === updatedEntity.id)
                && object.filter[updatedEntity.__typename]?.(updatedEntity, this.variables)
              ) {
                updated = true;
                data[propName] = data[propName].concat(this.addEntity(object, updatedEntity));
              }
            }
          }

          data[propName] =
            data[propName]
              .map((entity) => {
                const { entity: entity_, updated: updated_ } = this.updateEntity(entity, object, updates);
                updated = updated || updated_;
                return entity_;
              })
              .filter((entity) => entity);

          data[propName].forEach((entity) => {
            updated = this.doUpdate(updates, entity, object, updated);
          });
          break;
      }
    }

    return updated;
  }

  updateEntity(entity, meta, updates) {
    let updated = false;

    if (entity.__added) {
      delete entity.__added;
      return { entity, updated: true };
    }

    for (let updatedEntity of updates) {
      if (updatedEntity.id !== entity.id) {
        continue;
      }

      if (updatedEntity.__meta.isToBeDeleted) {
        return { entity: null, updated: true };
      }

      const scalars =
        (meta.inlineFragments[entity.__typename])
        ? { ...meta.scalars, ...meta.inlineFragments[entity.__typename].scalars }
        : meta.scalars;

      for (let propName of Object.keys(scalars)) {
        if (propName in updatedEntity) {
          if (areValuesEqual(entity[propName], updatedEntity[propName])) {
            continue;
          }
          entity[propName] = updatedEntity[propName];
          updated = true;
        }
      }

      const objects =
        (meta.inlineFragments[entity.__typename])
        ? { ...meta.objects, ...meta.inlineFragments[entity.__typename].objects }
        : meta.objects;

      for (const [propName, object] of Object.entries(objects)) {
        if (propName in updatedEntity === false) {
          continue;
        }

        switch (object.type) {
          case ObjectType.VIEWER_OBJECT:
          case ObjectType.ROOT_OBJECT:
            throw new Error();

          case ObjectType.EMBED:
          case ObjectType.EMBED_LIST:
          case ObjectType.EMBED_UNION:
          case ObjectType.EMBED_UNION_LIST:
            if (areValuesEqual(entity[propName], updatedEntity[propName])) {
              continue;
            }
            entity[propName] = updatedEntity[propName];
            updated = true;
            break;

          case ObjectType.ENTITY:
          case ObjectType.UNION:
          case ObjectType.INTERFACE:
            if (entity[propName]?.id === updatedEntity[propName]?.id) {
              continue;
            }

            if (updatedEntity[propName] === null) {
              entity[propName] = null;
              updated = true;
              continue;
            }

            entity[propName] = this.addEntity(object, updatedEntity[propName]);
            updated = true;
            break;

          case ObjectType.ENTITY_SET:
          case ObjectType.UNION_LIST:
          case ObjectType.INTERFACE_SET:
            const currentIds = entity[propName].map(({ id }) => id);
            const updatedIds = updatedEntity[propName].map(({ id }) => id);

            if (areValuesEqual(currentIds, updatedIds)) {
              continue;
            }

            if (isEmptyArray(updatedEntity[propName])) {
              if (updatedEntity.__meta.objects[propName].areElementsToBeOverridden) {
                entity[propName] = [];
                updated = true;
              }
              continue;
            }

            if (updatedEntity.__meta.objects[propName].areElementsToBeRemoved) {
              const idsToBeRemoved = updatedEntity[propName].map(({ id }) => id);
              entity[propName] = entity[propName].filter(({ id }) => !idsToBeRemoved.includes(id));
              updated = true;
              continue;
            }

            const entitiesToBeAdded =
              updatedEntity[propName]
                .filter((entity) => (
                  !currentIds.includes(entity.id)
                  && (!object.filter || object.filter[entity.__typename]?.(entity, this.variables))
                ))
                .map((entity) => this.addEntity(object, entity));

            if (updatedEntity.__meta.objects[propName].areElementsToBeOverridden) {
              entity[propName] = entity[propName].filter(({ id }) => updatedIds.includes(id));
              entity[propName] = entity[propName].concat(entitiesToBeAdded);
              updated = true;
              continue;
            }

            entity[propName] = entity[propName].concat(entitiesToBeAdded);
            updated = true;
            break;
          }
      }
    }

    return { entity, updated };
  }

  addEntity(meta, entity) {
    const newEntity = {
      ...filterProperties(entity, ['id', '__typename']),
      __added: true
    };

    const scalars =
      (meta.inlineFragments[entity.__typename])
      ? { ...meta.scalars, ...meta.inlineFragments[entity.__typename].scalars }
      : meta.scalars;

    for (let propName of Object.keys(scalars)) {
      if (propName in entity === false) {
        console.log(entity, propName)
        throw new Error();
      }

      newEntity[propName] = entity[propName];
    }

    const objects =
      (meta.inlineFragments[entity.__typename])
      ? { ...meta.objects, ...meta.inlineFragments[entity.__typename].objects }
      : meta.objects;

    for (const [propName, object] of Object.entries(objects)) {
      if (propName in entity === false) {
        throw new Error();
      }

      switch (object.type) {
        case ObjectType.VIEWER_OBJECT:
        case ObjectType.ROOT_OBJECT:
          throw new Error();

        case ObjectType.EMBED:
        case ObjectType.EMBED_LIST:
        case ObjectType.EMBED_UNION:
        case ObjectType.EMBED_UNION_LIST:
          newEntity[propName] = entity[propName];
          break;

        case ObjectType.ENTITY:
        case ObjectType.UNION:
        case ObjectType.INTERFACE:
          newEntity[propName] = (entity[propName] !== null)
            ? this.addEntity(object, entity[propName])
            : null;
          break;

        case ObjectType.ENTITY_SET:
        case ObjectType.UNION_LIST:
        case ObjectType.INTERFACE_SET:
          newEntity[propName] = entity[propName].map((entity) => this.addEntity(object, entity));
          break;
      }
    }

    return newEntity;
  }
}
