import { isObjectLiteral } from 'object-array-utils';
import ObjectType from '../document/ObjectType';
import { checkInstanceOfDocumentArg } from './helpers';

export default function deriveFromForeignKey(document, data, variables) {
  checkInstanceOfDocumentArg(document);

  return doDeriveFromForeignKey(document.rootObject, data, variables);
}

async function doDeriveFromForeignKey(meta, data, variables) {
  if (!isObjectLiteral(data)) {
    throw new Error();
  }

  data = { ...data };

  const objects =
    (data.__typename && meta.inlineFragments[data.__typename])
    ? { ...meta.objects, ...meta.inlineFragments[data.__typename].objects }
    : meta.objects;

  for (const [propName, object] of Object.entries(objects)) {
    if (object.derivedFrom) {
      continue;
    }

    if (object.derivedFromForeignKey) {
      const { foreignKey, fetch } = object.derivedFromForeignKey;

      switch (object.type) {
        case ObjectType.ENTITY:
          data[propName] = await buildDataGraph(object, await fetch(data[foreignKey], variables), variables);
          break;

        case ObjectType.ENTITY_SET:
          data[propName] = await Promise.all(
            (await fetch(data[foreignKey], variables)).map((entity) => buildDataGraph(object, entity, variables))
          );
          break;
      }

      delete data[foreignKey];
      continue;
    }

    switch (object.type) {
      case ObjectType.VIEWER_OBJECT:
      case ObjectType.ENTITY:
      case ObjectType.UNION:
      case ObjectType.INTERFACE:
        data[propName] = (data[propName] !== null)
          ? await doDeriveFromForeignKey(object, data[propName], variables)
          : null;
        break;

      case ObjectType.ENTITY_SET:
      case ObjectType.UNION_SET:
      case ObjectType.INTERFACE_SET:
        data[propName] = await Promise.all(data[propName].map((entity) => doDeriveFromForeignKey(object, entity, variables)));
        break;
    }
  }

  return data;
}

async function buildDataGraph(meta, dataToDeriveFrom, variables, result = {}) {
  if (dataToDeriveFrom === null) {
    return null;
  }

  if (!isObjectLiteral(dataToDeriveFrom)) {
    throw new Error();
  }

  dataToDeriveFrom = { ...dataToDeriveFrom };

  const scalars =
    (meta.inlineFragments[dataToDeriveFrom.__typename])
    ? { ...meta.scalars, ...meta.inlineFragments[dataToDeriveFrom.__typename].scalars }
    : meta.scalars;

  for (let propName of Object.keys(scalars)) {
    if (propName in dataToDeriveFrom === false) {
      throw new Error();
    }

    result[propName] = dataToDeriveFrom[propName];
  }

  const objects =
    (meta.inlineFragments[dataToDeriveFrom.__typename])
    ? { ...meta.objects, ...meta.inlineFragments[dataToDeriveFrom.__typename].objects }
    : meta.objects;

  for (const [propName, object] of Object.entries(objects)) {
    if (object.derivedFrom) {
      continue;
    }

    if (object.derivedFromForeignKey) {
      const { foreignKey, fetch } = object.derivedFromForeignKey;

      switch (object.type) {
        case ObjectType.ENTITY:
          result[propName] = await buildDataGraph(object, await fetch(dataToDeriveFrom[foreignKey], variables), variables);
          break;

        case ObjectType.ENTITY_SET:
          result[propName] = await Promise.all(
            (await fetch(dataToDeriveFrom[foreignKey], variables)).map((entity) => buildDataGraph(object, entity, variables))
          );
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
      case ObjectType.UNION:
      case ObjectType.INTERFACE:
        result[propName] = (dataToDeriveFrom[propName] !== null)
          ? await buildDataGraph(object, dataToDeriveFrom[propName], variables)
          : null;
        break;

      case ObjectType.ENTITY_SET:
      case ObjectType.UNION_SET:
      case ObjectType.INTERFACE_SET:
        result[propName] = await Promise.all(dataToDeriveFrom[propName].map((entity) => buildDataGraph(object, entity, variables)));
        break;
    }
  }

  return result;
}
