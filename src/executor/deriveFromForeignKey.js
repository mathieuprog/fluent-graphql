import { isObjectLiteral } from '../utils';
import ObjectType from '../document/ObjectType';
import Document from '../document/Document';

export default function deriveFromForeignKey(document, data) {
  if (document instanceof Document === false) {
    throw new Error();
  }

  return doDeriveFromForeignKey(document.rootObject, data);
}

function doDeriveFromForeignKey(meta, data) {
  if (!isObjectLiteral(data)) {
    throw new Error();
  }

  data = { ...data };

  for (const [propName, object] of Object.entries(meta.objects)) {
    if (object.derivedFrom) {
      const { foreignKey, fetch } = object.derivedFrom;

      switch (object.type) {
        case ObjectType.ENTITY:
          data[propName] = buildDataGraph(object, fetch(data[foreignKey]));
          break;

        case ObjectType.ENTITY_SET:
          data[propName] = fetch(data[foreignKey]).map((entity) => buildDataGraph(object, entity));
          break;
      }

      delete data[foreignKey];
      continue;
    }

    switch (object.type) {
      case ObjectType.VIEWER_OBJECT:
      case ObjectType.ENTITY:
        data[propName] = (data[propName] !== null)
          ? doDeriveFromForeignKey(object, data[propName])
          : null;
        break;

      case ObjectType.ENTITY_SET:
        data[propName] = data[propName].map((entity) => doDeriveFromForeignKey(object, entity));
        break;
    }
  }

  return data;
}

function buildDataGraph(meta, dataToDeriveFrom, result = {}) {
  if (dataToDeriveFrom === null) {
    return null;
  }

  if (!isObjectLiteral(dataToDeriveFrom)) {
    throw new Error();
  }

  dataToDeriveFrom = { ...dataToDeriveFrom };

  for (let propName of Object.keys(meta.scalars)) {
    if (propName in dataToDeriveFrom === false) {
      throw new Error();
    }

    result[propName] = dataToDeriveFrom[propName];
  }

  for (const [propName, object] of Object.entries(meta.objects)) {
    if (object.derivedFrom) {
      const { foreignKey, fetch } = object.derivedFrom;

      switch (object.type) {
        case ObjectType.ENTITY:
          result[propName] = buildDataGraph(object, fetch(dataToDeriveFrom[foreignKey]));
          break;

        case ObjectType.ENTITY_SET:
          result[propName] = fetch(dataToDeriveFrom[foreignKey]).map((entity) => buildDataGraph(object, entity));
          break;
      }
      continue;
    }

    if (propName in dataToDeriveFrom === false) {
      throw new Error();
    }

    switch (object.type) {
      case ObjectType.VIEWER_OBJECT:
      case ObjectType.ROOT_OBJECT:
        throw new Error();

      case ObjectType.EMBED:
      case ObjectType.EMBED_LIST:
        result[propName] = dataToDeriveFrom[propName];
        break;

      case ObjectType.ENTITY:
        result[propName] = (dataToDeriveFrom[propName] !== null)
          ? buildDataGraph(object, dataToDeriveFrom[propName])
          : null;
        break;

      case ObjectType.ENTITY_SET:
        result[propName] = dataToDeriveFrom[propName].map((entity) => buildDataGraph(object, entity));
        break;
    }
  }

  return result;
}
