import { isPlainObject } from 'object-array-utils';
import ObjectType from '../document/ObjectType';
import { throwIfNotInstanceOfDocument } from './helpers';

export default function deriveFromReference(document, data, variables, context) {
  throwIfNotInstanceOfDocument(document);

  return doDeriveFromReference(document.rootObject, data, variables, context);
}

async function doDeriveFromReference(meta, data, variables, context) {
  if (!isPlainObject(data)) {
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

    if (object.derivedFromReference) {
      const { foreignKey, fetch } = object.derivedFromReference;

      switch (object.type) {
        case ObjectType.Entity:
          try {
            data[propName] = await buildDataGraph(object, await fetch(data[foreignKey], variables, context), variables, context);
          } catch (e) {
            setTimeout(() => { throw e }, 0);
            return;
          }
          break;

        case ObjectType.EntitySet:
          try {
            data[propName] = await Promise.all(
              (await fetch(data[foreignKey], variables, context)).map((entity) => buildDataGraph(object, entity, variables, context))
            );
          } catch (e) {
            setTimeout(() => { throw e }, 0);
            return;
          }
          break;
      }

      delete data[foreignKey];
      continue;
    }

    switch (object.type) {
      case ObjectType.ViewerObject:
      case ObjectType.Wrapper:
      case ObjectType.Entity:
      case ObjectType.Union:
      case ObjectType.Interface:
        data[propName] = (data[propName] !== null)
          ? await doDeriveFromReference(object, data[propName], variables, context)
          : null;
        break;

      case ObjectType.EntitySet:
      case ObjectType.UnionSet:
      case ObjectType.InterfaceSet:
        data[propName] = await Promise.all(data[propName].map((entity) => doDeriveFromReference(object, entity, variables, context)));
        break;
    }
  }

  return data;
}

async function buildDataGraph(meta, dataToDeriveFrom, variables, context, result = {}) {
  if (dataToDeriveFrom === null) {
    return null;
  }

  if (!isPlainObject(dataToDeriveFrom)) {
    throw new Error();
  }

  dataToDeriveFrom = { ...dataToDeriveFrom };

  const scalars =
    (meta.inlineFragments[dataToDeriveFrom.__typename])
    ? { ...meta.scalars, ...meta.inlineFragments[dataToDeriveFrom.__typename].scalars }
    : meta.scalars;

  for (let propName of Object.keys(scalars)) {
    if (propName in dataToDeriveFrom === false) {
      throw new Error(`prop name "${propName}" not in ${JSON.stringify(dataToDeriveFrom)} (operation ${meta.getDocument().operationName})`);
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

    if (object.derivedFromReference) {
      const { foreignKey, fetch } = object.derivedFromReference;

      switch (object.type) {
        case ObjectType.Entity:
          try {
            result[propName] = await buildDataGraph(object, await fetch(dataToDeriveFrom[foreignKey], variables, context), variables, context);
          } catch (e) {
            setTimeout(() => { throw e }, 0);
            return;
          }
          break;

        case ObjectType.EntitySet:
          try {
            result[propName] = await Promise.all(
              (await fetch(dataToDeriveFrom[foreignKey], variables, context)).map((entity) => buildDataGraph(object, entity, variables, context))
            );
          } catch (e) {
            setTimeout(() => { throw e }, 0);
            return;
          }
          break;
      }
      continue;
    }

    if (propName in dataToDeriveFrom === false) {
      throw new Error();
    }

    switch (object.type) {
      case ObjectType.ViewerObject:
      case ObjectType.Wrapper:
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
          ? await buildDataGraph(object, dataToDeriveFrom[propName], variables, context)
          : null;
        break;

      case ObjectType.EntitySet:
      case ObjectType.UnionSet:
      case ObjectType.InterfaceSet:
        result[propName] = await Promise.all(dataToDeriveFrom[propName].map((entity) => buildDataGraph(object, entity, variables, context)));
        break;
    }
  }

  return result;
}
