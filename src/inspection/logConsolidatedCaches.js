import { areValuesEqual, filterProperties, isArray, isObjectLiteral } from 'object-array-utils';
import Document from '../document/Document';
import OperationType from '../document/OperationType';

export default function logConsolidatedCaches() {
  console.dir(consolidatedCaches(), { depth: null });
}

function consolidatedCaches() {
  let normalizedEntities = [];

  for (let document of Document.instances) {
    if (document.operationType !== OperationType.Query || !document.executor) {
      continue;
    }

    const allCachedData =
      Object.values(document.executor.queryRegistry.registry)
        .map((query) => query.getCachedData())
        .filter((data) => data);

    for (let data of allCachedData) {
      normalizedEntities = normalizedEntities.concat(normalizeEntities(data));
    }
  }

  const normalizedEntitiesGroupedById = group(normalizedEntities, ({ id }) => id);

  let consolidatedEntities = [];
  for (let entities of Object.values(normalizedEntitiesGroupedById)) {
    consolidatedEntities = consolidatedEntities.concat(mergeEntities(entities));
  }
  return group(consolidatedEntities, ({ __typename }) => __typename);
}

function mergeEntities(entities) {
  return entities.reduce((mergedEntity, entity) => mergeEntity(mergedEntity, entity), {});
}

function mergeEntity(entity1, entity2) {
  for (const [propName, propValue] of Object.entries(entity2)) {
    if (propName in entity1 === false) {
      entity1[propName] = propValue;
      continue;
    }

    if (!areValuesEqual(entity1[propName], propValue)) {
      console.error(`Cached entities with id ${entity1.id} and typename ${entity1.__typename} contain different values`);
      console.dir(entity1, { depth: null });
      console.dir(entity2, { depth: null });
    }

    entity1[propName] = propValue;
  }

  return entity1;
}

export function normalizeEntities(data, normalizedEntities = []) {
  if (isObjectLiteral(data)) {
    if (data.id) {
      normalizedEntities.push(normalizeEntity(data));
    }

    for (let propValue of Object.values(data)) {
      normalizeEntities(propValue, normalizedEntities);
    }
  } else if (isArray(data)) {
    data.forEach((e) => { normalizeEntities(e, normalizedEntities) });
  }

  return normalizedEntities;
}

export function normalizeEntity(entity) {
  if (!entity.id) {
    throw new Error();
  }

  entity = { ...entity };

  for (const [propName, propValue] of Object.entries(entity)) {
    entity[propName] = doNormalizeEntity(propValue);
  }

  return entity;
}

function doNormalizeEntity(data) {
  if (isObjectLiteral(data)) {
    if (data.id) {
      return filterProperties(data, ['id', '__typename']);
    }

    data = { ...data };

    for (const [propName, propValue] of Object.entries(data)) {
      data[propName] = doNormalizeEntity(propValue);
    }

    return data;
  }

  if (isArray(data)) {
    return data.map(doNormalizeEntity);
  }

  return data;
}

// TODO: https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/group
function group(arrayOfObjects, getKey) {
  return arrayOfObjects.reduce((resultingObject, object) => {
    const key = getKey(object);

    if (!resultingObject[key]) {
      resultingObject[key] = [];
    }
    resultingObject[key].push(object);

    return resultingObject;
  }, {});
}
