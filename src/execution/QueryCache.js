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

  update(newData) {
    const { data, updated } = this.doUpdate(newData, this.data, this.document.rootObject);

    this.data = data;
    this.transformedData = this.document.transform(data);

    return updated;
  }

  doUpdate(newData, data, meta, updated = false) {
    if (!isObjectLiteral(data)) {
      throw new Error();
    }

    data = { ...data };

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
          const { data: data_, updated: updated_ } = this.doUpdate(newData, data[propName], object, updated);
          data[propName] = data_;
          updated = updated || updated_;
          break;

        case ObjectType.ENTITY:
        case ObjectType.UNION:
        case ObjectType.INTERFACE:
          if (object.filter) {
            for (let entity of newData) {
              if (
                data[propName]?.id !== entity.id
                && object.filter[entity.__typename]?.(entity, this.variables)
              ) {
                updated = true;
                data[propName] = this.addEntity(object, entity);
              }
            }
          }

          if (data[propName] !== null) {
            const { entity, updated: updated_ } = this.updateEntity(data[propName], object, newData);
            data[propName] = entity;
            updated = updated || updated_;
          }

          if (data[propName] !== null) {
            const { data: data_, updated: updated_ } = this.doUpdate(newData, data[propName], object, updated);
            data[propName] = data_;
            updated = updated || updated_;
          }
          break;

        case ObjectType.ENTITY_SET:
        case ObjectType.UNION_SET:
        case ObjectType.INTERFACE_SET:
          if (object.filter) {
            for (let entity of newData) {
              if (
                !data[propName].some(({ id }) => id === entity.id)
                && object.filter[entity.__typename]?.(entity, this.variables)
              ) {
                updated = true;
                data[propName] = data[propName].concat(this.addEntity(object, entity));
              }
            }
          }

          data[propName] =
            data[propName]
              .map((entity) => {
                const { entity: entity_, updated: updated_ } = this.updateEntity(entity, object, newData);
                updated = updated || updated_;
                return entity_;
              })
              .filter((entity) => entity);

          data[propName] =
            data[propName].map((entity) => {
              const { data, updated: updated_ } = this.doUpdate(newData, entity, object, updated);
              updated = updated || updated_;
              return data;
            });
          break;
      }
    }

    return { data, updated };
  }

  updateEntity(entity, meta, newData) {
    entity = { ...entity };

    let updated = false;

    if (entity.__added) {
      delete entity.__added;
      return { entity, updated: true };
    }

    for (let latestEntity of newData) {
      if (latestEntity.id !== entity.id) {
        continue;
      }

      if (latestEntity.__meta.isToBeDeleted) {
        return { entity: null, updated: true };
      }

      const scalars =
        (meta.inlineFragments[entity.__typename])
        ? { ...meta.scalars, ...meta.inlineFragments[entity.__typename].scalars }
        : meta.scalars;

      for (let propName of Object.keys(scalars)) {
        if (propName in latestEntity) {
          if (areValuesEqual(entity[propName], latestEntity[propName])) {
            continue;
          }
          entity[propName] = latestEntity[propName];
          updated = true;
        }
      }

      const objects =
        (meta.inlineFragments[entity.__typename])
        ? { ...meta.objects, ...meta.inlineFragments[entity.__typename].objects }
        : meta.objects;

      for (const [propName, object] of Object.entries(objects)) {
        if (propName in latestEntity === false) {
          continue;
        }

        switch (object.type) {
          case ObjectType.VIEWER_OBJECT:
          case ObjectType.ROOT_OBJECT:
            throw new Error();

          case ObjectType.EMBED:
          case ObjectType.EMBED_LIST:
            if (areValuesEqual(entity[propName], latestEntity[propName])) {
              continue;
            }
            entity[propName] = latestEntity[propName];
            updated = true;
            break;

          case ObjectType.ENTITY:
          case ObjectType.UNION:
          case ObjectType.INTERFACE:
            if (entity[propName]?.id === latestEntity[propName]?.id) {
              continue;
            }

            if (latestEntity[propName] === null) {
              entity[propName] = null;
              updated = true;
              continue;
            }

            entity[propName] = this.addEntity(object, latestEntity[propName]);
            updated = true;
            break;

          case ObjectType.ENTITY_SET:
          case ObjectType.UNION_SET:
          case ObjectType.INTERFACE_SET:
            const cachedIds = entity[propName].map(({ id }) => id);
            const latestIds = latestEntity[propName].map(({ id }) => id);

            if (areValuesEqual(cachedIds, latestIds)) {
              continue;
            }

            if (isEmptyArray(latestEntity[propName])) {
              if (latestEntity.__meta.objects[propName].areElementsToBeOverridden) {
                entity[propName] = [];
                updated = true;
              }
              continue;
            }

            if (latestEntity.__meta.objects[propName].areElementsToBeRemoved) {
              const idsToBeRemoved = latestEntity[propName].map(({ id }) => id);
              entity[propName] = entity[propName].filter(({ id }) => !idsToBeRemoved.includes(id));
              updated = true;
              continue;
            }

            const entitiesToBeAdded =
            latestEntity[propName]
                .filter((entity) => (
                  !cachedIds.includes(entity.id)
                  && (!object.filter || object.filter[entity.__typename]?.(entity, this.variables))
                ))
                .map((entity) => this.addEntity(object, entity));

            if (latestEntity.__meta.objects[propName].areElementsToBeOverridden) {
              entity[propName] = entity[propName].filter(({ id }) => latestIds.includes(id));
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
        case ObjectType.UNION_SET:
        case ObjectType.INTERFACE_SET:
          newEntity[propName] = entity[propName].map((entity) => this.addEntity(object, entity));
          break;
      }
    }

    return newEntity;
  }
}
