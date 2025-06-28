import { areDataEqual, deepFreezePlain, differencePrimitives, makeCopyOnWriteObjectSetter } from 'object-array-utils';
import ObjectType from '../../document/ObjectType';
import copyEntity from './copyEntity';

export default function refreshEntity(entity, meta, updates, variables) {
  const set = makeCopyOnWriteObjectSetter(entity);

  updates = updates.filter(({ entity: { id } }) => entity.id === id);

  if (updates.some(({ entity: { __meta: { isToBeDeleted } } }) => isToBeDeleted)) {
    return null;
  }

  for (let { entityUpdates } of updates) {
    const scalars =
      (meta.inlineFragments[entity.__typename])
      ? { ...meta.scalars, ...meta.inlineFragments[entity.__typename].scalars }
      : meta.scalars;

    for (let propName of Object.keys(scalars)) {
      if (propName in entityUpdates) {
        const opts = { unboxPrimitives: true, unorderedArrays: true, areNonPlainObjectsEqual: (a, b) => {
          const errorMessage = 'Missing implementation for areNonPlainObjectsEqual';
          console.error(errorMessage);
          console.dir(a, { depth: null });
          console.dir(b, { depth: null });
          throw new Error(errorMessage);
        } };
        if (areDataEqual(entity[propName], entityUpdates[propName], opts)) {
          continue;
        }
        entity = set(propName, entityUpdates[propName]);
      }
    }

    const virtualScalars =
      (meta.inlineFragments[entity.__typename])
      ? { ...meta.virtualScalars, ...meta.inlineFragments[entity.__typename].virtualScalars }
      : meta.virtualScalars;

    for (let propName of Object.keys(virtualScalars)) {
      if (propName in entityUpdates) {
        const opts = { unboxPrimitives: true, unorderedArrays: true, areNonPlainObjectsEqual: (a, b) => {
          const errorMessage = 'Missing implementation for areNonPlainObjectsEqual';
          console.error(errorMessage);
          console.dir(a, { depth: null });
          console.dir(b, { depth: null });
          throw new Error(errorMessage);
        } };
        if (areDataEqual(entity[propName], entityUpdates[propName], opts)) {
          continue;
        }
        entity = set(propName, entityUpdates[propName]);
      }
    }

    const objects =
      (meta.inlineFragments[entity.__typename])
      ? { ...meta.objects, ...meta.inlineFragments[entity.__typename].objects }
      : meta.objects;

    for (const [propName, object] of Object.entries(objects)) {
      if (propName in entityUpdates === false) {
        continue;
      }

      switch (object.type) {
        case ObjectType.ViewerObject:
        case ObjectType.RootObject:
          throw new Error();

        case ObjectType.Embed:
        case ObjectType.EmbedList:
          const opts = { unboxPrimitives: true, unorderedArrays: true, areNonPlainObjectsEqual: (a, b) => {
            const errorMessage = 'Missing implementation for areNonPlainObjectsEqual';
            console.error(errorMessage);
            console.dir(a, { depth: null });
            console.dir(b, { depth: null });
            throw new Error(errorMessage);
          } };
          if (areDataEqual(entity[propName], entityUpdates[propName], opts)) {
            continue;
          }
          entity = set(propName, entityUpdates[propName]);
          break;

        case ObjectType.Entity:
        case ObjectType.Union:
        case ObjectType.Interface:
          if (entity[propName]?.id === entityUpdates[propName]?.id) {
            continue;
          }

          if (entityUpdates[propName] === null) {
            entity = set(propName, null);
            continue;
          }

          entity = set(propName, copyEntity(object, entityUpdates[propName]));
          break;

        case ObjectType.EntitySet:
        case ObjectType.UnionSet:
        case ObjectType.InterfaceSet:
          const cachedIds = entity[propName].map(({ id }) => id);
          const freshIds = entityUpdates[propName].map(({ id }) => id);

          if (differencePrimitives(cachedIds, freshIds).length === 0) {
            continue;
          }

          if (freshIds.length === 0) {
            if (entityUpdates.__meta.objects[propName].areElementsToBeReplaced) {
              entity = set(propName, []);
            }
            continue;
          }

          if (entityUpdates.__meta.objects[propName].areElementsToBeRemoved) {
            const filteredEntities = entity[propName].filter(({ id }) => !freshIds.includes(id));
            if (filteredEntities.length !== cachedIds.length) {
              entity = set(propName, filteredEntities);
            }
            continue;
          }

          const entitiesToBeAdded =
            entityUpdates[propName]
              .filter((entity) => (
                !cachedIds.includes(entity.id)
                && (!object.addEntityFiltersByTypename || object.addEntityFiltersByTypename[entity.__typename]?.(entity, variables, entityUpdates))
              ))
              .map((entity) => copyEntity(object, entity));

          if (entityUpdates.__meta.objects[propName].areElementsToBeReplaced) {
            const filteredEntities = entity[propName].filter(({ id }) => freshIds.includes(id));
            if (filteredEntities.length !== cachedIds.length || entitiesToBeAdded.length > 0) {
              entity = set(propName, filteredEntities.concat(entitiesToBeAdded));
            }
            continue;
          }

          if (entitiesToBeAdded.length > 0) {
            entity = set(propName, entity[propName].concat(entitiesToBeAdded));
          }
          break;
        }
    }
  }

  return deepFreezePlain(entity);
}
