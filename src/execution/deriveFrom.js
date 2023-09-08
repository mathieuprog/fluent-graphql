import { isObjectLiteral } from 'object-array-utils';
import ObjectType from '../document/ObjectType';
import { throwIfNotInstanceOfDocument } from './helpers';

export default function deriveFrom(document, data, variables, context) {
  throwIfNotInstanceOfDocument(document);

  return doDeriveFrom(document.rootObject, data, variables, context);
}

async function doDeriveFrom(meta, data, variables, context) {
  if (!isObjectLiteral(data)) {
    throw new Error();
  }

  data = { ...data };

  const objects =
    (data.__typename && meta.inlineFragments[data.__typename])
    ? { ...meta.objects, ...meta.inlineFragments[data.__typename].objects }
    : meta.objects;

  for (const [propName, object] of Object.entries(objects)) {
    if (object.derivedFromForeignKey) {
      continue;
    }

    if (object.derivedFrom) {
      const { fetch } = object.derivedFrom;

      switch (object.type) {
        case ObjectType.Entity:
          data[propName] = buildDataGraph(object, await fetch(variables, context));
          break;

        case ObjectType.EntitySet:
          data[propName] = (await fetch(variables, context)).map((entity) => buildDataGraph(object, entity));
          break;
      }

      continue;
    }

    switch (object.type) {
      case ObjectType.ViewerObject:
      case ObjectType.Entity:
      case ObjectType.Union:
      case ObjectType.Interface:
        data[propName] = (data[propName] !== null)
          ? await doDeriveFrom(object, data[propName], variables, context)
          : null;
        break;

      case ObjectType.EntitySet:
      case ObjectType.UnionSet:
      case ObjectType.InterfaceSet:
        data[propName] = await Promise.all(data[propName].map((entity) => doDeriveFrom(object, entity, variables, context)));
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
    if (object.derivedFromForeignKey) {
      throw new Error();
    }

    if (object.derivedFrom) {
      throw new Error();
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
          ? buildDataGraph(object, dataToDeriveFrom[propName])
          : null;
        break;

      case ObjectType.EntitySet:
      case ObjectType.UnionSet:
      case ObjectType.InterfaceSet:
        result[propName] = dataToDeriveFrom[propName].map((entity) => buildDataGraph(object, entity));
        break;
    }
  }

  return result;
}
