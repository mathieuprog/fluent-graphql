import { isObjectLiteral } from '../utils';
import ObjectType from '../document/ObjectType';
import Document from '../document/Document';

export default function transform(document, data) {
  if (document instanceof Document === false) {
    throw new Error();
  }

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
        data[propName] = (data[propName] !== null)
          ? doTransform(object, data[propName])
          : null;
        break;

      case ObjectType.ENTITY_SET:
      case ObjectType.EMBED_LIST:
        data[propName] = data[propName].map((value) => doTransform(object, value));
        break;
    }
  }

  return data;
}
