import { isObjectLiteral } from '../utils';
import ObjectType from '../document/ObjectType';
import { checkInstanceOfDocumentArg } from './helpers';

export default function transform(document, data) {
  checkInstanceOfDocumentArg(document);

  return doTransform(document.rootObject, data);
}

function doTransform(meta, data) {
  if (!isObjectLiteral(data)) {
    throw new Error();
  }

  data = { ...data };

  for (const [propName, { transformer }] of Object.entries(meta.scalars)) {
    if (propName in data === false) {
      throw new Error();
    }

    data[propName] = transformer(data[propName]);
  }

  for (const [propName, object] of Object.entries(meta.objects)) {
    if (propName in data === false) {
      throw new Error();
    }

    if (object.derivedFrom) {
      continue;
    }

    switch (object.type) {
      case ObjectType.VIEWER_OBJECT:
      case ObjectType.ENTITY:
      case ObjectType.EMBED:
      case ObjectType.INTERFACE:
        if (data[propName] !== null) {
          data[propName] = doTransform(object, data[propName]);
        }
        break;

      case ObjectType.ENTITY_SET:
      case ObjectType.EMBED_LIST:
      case ObjectType.INTERFACE_SET:
        data[propName] = data[propName].map((value) => doTransform(object, value));
        break;
    }

    switch (object.type) {
      case ObjectType.UNION:
      case ObjectType.INTERFACE:
        if (data[propName] !== null) {
          if (!object.inlineFragments[data[propName].__typename]) {
            throw new Error();
          }
          data[propName] = doTransform(object.inlineFragments[data[propName].__typename], data[propName]);
        }
        break;

      case ObjectType.UNION_LIST:
      case ObjectType.INTERFACE_SET:
        data[propName] = data[propName].map((value) => {
          if (!object.inlineFragments[value.__typename]) {
            throw new Error();
          }
          return doTransform(object.inlineFragments[value.__typename], value);
        });
        break;
    }
  }

  return data;
}
