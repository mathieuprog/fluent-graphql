import {
  areValuesEqual,
  filterProperties,
  isEmptyArray,
  isObjectLiteral
} from '../utils';
import ObjectType from '../document/ObjectType';
import Document from '../document/Document';

export default class QueryCache {
  constructor(document, data, variables) {
    if (document instanceof Document === false) {
      throw new Error();
    }
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

    for (const [propName, object] of Object.entries(meta.objects)) {
      if (propName in data === false) {
        throw new Error();
      }

      switch (object.type) {
        case ObjectType.VIEWER_OBJECT:
          updated = this.doUpdate(updates, data[propName], object, updated);
          break;

        case ObjectType.ENTITY:
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
          data[propName] =
            data[propName]
              .map((entity) => {
                const { entity: entity_, updated: updated_ } = this.updateEntity(entity, object, updates);
                updated = updated || updated_;
                return entity_;
              })
              .filter((entity) => entity);

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

      for (let propName of Object.keys(meta.scalars)) {
        if (propName in updatedEntity) {
          if (areValuesEqual(entity[propName], updatedEntity[propName])) {
            continue;
          }
          entity[propName] = updatedEntity[propName];
          updated = true;
        }
      }

      for (const [propName, object] of Object.entries(meta.objects)) {
        if (propName in updatedEntity === false) {
          continue;
        }

        switch (object.type) {
          case ObjectType.VIEWER_OBJECT:
          case ObjectType.ROOT_OBJECT:
            throw new Error();

          case ObjectType.EMBED:
          case ObjectType.EMBED_LIST:
            if (areValuesEqual(entity[propName], updatedEntity[propName])) {
              continue;
            }
            entity[propName] = updatedEntity[propName];
            updated = true;
            break;

          case ObjectType.ENTITY:
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

  addEntity(meta, updatedEntity) {
    const newEntity = {
      ...filterProperties(updatedEntity, ['id', '__typename']),
      __added: true
    };

    for (let propName of Object.keys(meta.scalars)) {
      if (propName in updatedEntity === false) {
        throw new Error();
      }

      newEntity[propName] = updatedEntity[propName];
    }

    for (const [propName, object] of Object.entries(meta.objects)) {
      if (propName in updatedEntity === false) {
        throw new Error();
      }

      switch (object.type) {
        case ObjectType.VIEWER_OBJECT:
        case ObjectType.ROOT_OBJECT:
          throw new Error();

        case ObjectType.EMBED:
        case ObjectType.EMBED_LIST:
          newEntity[propName] = updatedEntity[propName];
          break;

        case ObjectType.ENTITY:
          newEntity[propName] = (updatedEntity[propName] !== null)
            ? this.addEntity(object, updatedEntity[propName])
            : null;
          break;

        case ObjectType.ENTITY_SET:
          newEntity[propName] = updatedEntity[propName].map((entity) => this.addEntity(object, entity));
          break;
      }
    }

    return newEntity;
  }
}
