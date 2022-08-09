import { areValuesEqual, isEmptyArray } from 'object-array-utils';
import ObjectType from '../../document/ObjectType';
import copyEntity from './copyEntity';

export default function refreshEntity(entity, meta, freshEntities, variables) {
  const updatePropImmutably = ((original) => {
    let data = original;
    return (prop, value) => {
      data = (original === data) ? { ...data } : data;
      data[prop] = value;
      return data;
    };
  })(entity);

  freshEntities = freshEntities.filter(({ id }) => entity.id === id);

  if (freshEntities.some(({ __meta: { isToBeDeleted } }) => isToBeDeleted)) {
    return null;
  }

  for (let freshEntity of freshEntities) {
    const scalars =
      (meta.inlineFragments[entity.__typename])
      ? { ...meta.scalars, ...meta.inlineFragments[entity.__typename].scalars }
      : meta.scalars;

    for (let propName of Object.keys(scalars)) {
      if (propName in freshEntity) {
        if (areValuesEqual(entity[propName], freshEntity[propName])) {
          continue;
        }
        entity = updatePropImmutably(propName, freshEntity[propName]);
      }
    }

    const objects =
      (meta.inlineFragments[entity.__typename])
      ? { ...meta.objects, ...meta.inlineFragments[entity.__typename].objects }
      : meta.objects;

    for (const [propName, object] of Object.entries(objects)) {
      if (propName in freshEntity === false) {
        continue;
      }

      switch (object.type) {
        case ObjectType.VIEWER_OBJECT:
        case ObjectType.ROOT_OBJECT:
          throw new Error();

        case ObjectType.EMBED:
        case ObjectType.EMBED_LIST:
          if (areValuesEqual(entity[propName], freshEntity[propName])) {
            continue;
          }
          entity = updatePropImmutably(propName, freshEntity[propName]);
          break;

        case ObjectType.ENTITY:
        case ObjectType.UNION:
        case ObjectType.INTERFACE:
          if (entity[propName]?.id === freshEntity[propName]?.id) {
            continue;
          }

          if (freshEntity[propName] === null) {
            entity = updatePropImmutably(propName, null);
            continue;
          }

          entity = updatePropImmutably(propName, copyEntity(object, freshEntity[propName]));
          break;

        case ObjectType.ENTITY_SET:
        case ObjectType.UNION_SET:
        case ObjectType.INTERFACE_SET:
          const cachedIds = entity[propName].map(({ id }) => id);
          const freshIds = freshEntity[propName].map(({ id }) => id);

          if (areValuesEqual(cachedIds, freshIds)) {
            continue;
          }

          if (isEmptyArray(freshIds)) {
            if (freshEntity.__meta.objects[propName].areElementsToBeOverridden) {
              entity = updatePropImmutably(propName, []);
            }
            continue;
          }

          if (freshEntity.__meta.objects[propName].areElementsToBeRemoved) {
            const filteredEntities = entity[propName].filter(({ id }) => !freshIds.includes(id));
            if (filteredEntities.length !== cachedIds.length) {
              entity = updatePropImmutably(propName, filteredEntities);
            }
            continue;
          }

          const entitiesToBeAdded =
            freshEntity[propName]
              .filter((entity) => (
                !cachedIds.includes(entity.id)
                && (!object.filter || object.filter[entity.__typename]?.(entity, variables))
              ))
              .map((entity) => copyEntity(object, entity));

          if (freshEntity.__meta.objects[propName].areElementsToBeOverridden) {
            const filteredEntities = entity[propName].filter(({ id }) => freshIds.includes(id));
            if (filteredEntities.length !== cachedIds.length || entitiesToBeAdded.length > 0) {
              entity = updatePropImmutably(propName, filteredEntities.concat(entitiesToBeAdded));
            }
            continue;
          }

          if (entitiesToBeAdded.length > 0) {
            entity = updatePropImmutably(propName, entity[propName].concat(entitiesToBeAdded));
          }
          break;
        }
    }
  }

  return entity;
}
