import { isObjectLiteral } from 'object-array-utils';
import ObjectType from '../document/ObjectType';
import { throwIfNotInstanceOfDocument } from './helpers';

export default function deriveFromForeignKey(document, data, variables) {
  throwIfNotInstanceOfDocument(document);

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
        case ObjectType.Entity:
          data[propName] = await buildDataGraph(object, await fetch(data[foreignKey], variables), variables);
          break;

        case ObjectType.EntitySet:
          data[propName] = await Promise.all(
            (await fetch(data[foreignKey], variables)).map((entity) => buildDataGraph(object, entity, variables))
          );
          break;
      }

      delete data[foreignKey];
      continue;
    }

    switch (object.type) {
      case ObjectType.ViewerObject:
      case ObjectType.Entity:
      case ObjectType.Union:
      case ObjectType.Interface:
        data[propName] = (data[propName] !== null)
          ? await doDeriveFromForeignKey(object, data[propName], variables)
          : null;
        break;

      case ObjectType.EntitySet:
      case ObjectType.UnionSet:
      case ObjectType.InterfaceSet:
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
      throw new Error(`prop name ${propName} not in ${JSON.stringify(dataToDeriveFrom)}`);
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
        case ObjectType.Entity:
          result[propName] = await buildDataGraph(object, await fetch(dataToDeriveFrom[foreignKey], variables), variables);
          break;

        case ObjectType.EntitySet:
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
      case ObjectType.ViewerObject:
      case ObjectType.RootObject:
        throw new Error();

      case ObjectType.Embed:
      case ObjectType.EmbedList:
        result[propName] = dataToDeriveFrom[propName];
        break;

      case ObjectType.Entity:
      case ObjectType.Union:
      case ObjectType.Interface:
        result[propName] = (dataToDeriveFrom[propName] !== null)
          ? await buildDataGraph(object, dataToDeriveFrom[propName], variables)
          : null;
        break;

      case ObjectType.EntitySet:
      case ObjectType.UnionSet:
      case ObjectType.InterfaceSet:
        result[propName] = await Promise.all(dataToDeriveFrom[propName].map((entity) => buildDataGraph(object, entity, variables)));
        break;
    }
  }

  return result;
}
