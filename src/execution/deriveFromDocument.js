import { isObjectLiteral } from '../utils';
import ObjectType from '../document/ObjectType';
import { checkInstanceOfDocumentArg } from './helpers';

export default function deriveFromDocument(document, data, variables) {
  checkInstanceOfDocumentArg(document);

  return doDeriveFromDocument(document.rootObject, data, variables);
}

async function doDeriveFromDocument(meta, data, variables) {
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

    if (object.derivedFromDocument) {
      const { document, extract, takeVariables } = object.derivedFromDocument;

      const derivedData = await document.execute(takeVariables(variables));

      switch (object.type) {
        case ObjectType.ENTITY:
          data[propName] = buildDataGraph(object, extract(derivedData));
          break;

        case ObjectType.ENTITY_SET:
          data[propName] = extract(derivedData).map((entity) => buildDataGraph(object, entity));
          break;
      }

      continue;
    }

    switch (object.type) {
      case ObjectType.VIEWER_OBJECT:
      case ObjectType.ENTITY:
      case ObjectType.UNION:
      case ObjectType.INTERFACE:
        data[propName] = (data[propName] !== null)
          ? await doDeriveFromDocument(object, data[propName], variables)
          : null;
        break;

      case ObjectType.ENTITY_SET:
      case ObjectType.UNION_LIST:
      case ObjectType.INTERFACE_SET:
        data[propName] = await Promise.all(data[propName].map((entity) => doDeriveFromDocument(object, entity, variables)));
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

    if (object.derivedFromDocument) {
      throw new Error();
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
          ? buildDataGraph(object, dataToDeriveFrom[propName])
          : null;
        break;

      case ObjectType.ENTITY_SET:
      case ObjectType.UNION_LIST:
      case ObjectType.INTERFACE_SET:
        result[propName] = dataToDeriveFrom[propName].map((entity) => buildDataGraph(object, entity));
        break;
    }
  }

  return result;
}
