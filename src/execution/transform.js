import { isObjectLiteral } from 'object-array-utils';
import ObjectType from '../document/ObjectType';
import { throwIfNotInstanceOfDocument } from './helpers';

export default function transform(document, data) {
  throwIfNotInstanceOfDocument(document);

  return doTransform(document.rootObject, data);
}

function doTransform(meta, data) {
  if (!isObjectLiteral(data)) {
    throw new Error();
  }

  const updatePropImmutably = ((original) => {
    let data = original;
    return (prop, value) => {
      data = (original === data) ? { ...data } : data;
      data[prop] = value;
      return data;
    };
  })(data);

  for (const [propName, { transformer }] of Object.entries(meta.scalars)) {
    if (propName in data === false) {
      throw new Error();
    }

    const transformedData = transformer(data[propName]);
    if (data[propName] !== transformedData) {
      data = updatePropImmutably(propName, transformedData);
    }
  }

  for (const [propName, object] of Object.entries(meta.objects)) {
    if (object.derivedFromForeignKey || object.derivedFrom) {
      continue;
    }

    if (propName in data === false) {
      throw new Error();
    }

    switch (object.type) {
      case ObjectType.VIEWER_OBJECT:
      case ObjectType.ENTITY:
      case ObjectType.EMBED:
      case ObjectType.INTERFACE:
        if (data[propName] !== null) {
          const transformedData = doTransform(object, data[propName]);
          if (data[propName] !== transformedData) {
            data = updatePropImmutably(propName, transformedData);
          }
        }
        break;

      case ObjectType.ENTITY_SET:
      case ObjectType.EMBED_LIST:
      case ObjectType.INTERFACE_SET:
        let updated = false;
        const newData =
          data[propName].map((value) => {
            const transformedData = doTransform(object, value);
            updated = updated || (transformedData !== value);
            return transformedData;
          });

        if (updated) {
          data = updatePropImmutably(propName, newData);
        }
        break;
    }

    switch (object.type) {
      case ObjectType.UNION:
      case ObjectType.INTERFACE:
        if (data[propName] !== null) {
          if (!object.inlineFragments[data[propName].__typename]) {
            throw new Error();
          }
          const transformedData = doTransform(object.inlineFragments[data[propName].__typename], data[propName]);
          if (data[propName] !== transformedData) {
            data = updatePropImmutably(propName, transformedData);
          }
        }
        break;

      case ObjectType.UNION_SET:
      case ObjectType.INTERFACE_SET:
        let updated = false;
        const newData =
          data[propName].map((value) => {
            if (!object.inlineFragments[value.__typename]) {
              throw new Error();
            }
            const transformedData = doTransform(object.inlineFragments[value.__typename], value);
            updated = updated || (transformedData !== value);
            return transformedData;
          });

        if (updated) {
          data = updatePropImmutably(propName, newData);
        }
        break;
    }
  }

  return data;
}
