import { deepFreezePlain, isPlainObject, makeCopyOnWriteObjectSetter } from 'object-array-utils';
import ObjectType from '../document/ObjectType';
import { throwIfNotInstanceOfDocument } from './helpers';

export default function transform(document, data) {
  throwIfNotInstanceOfDocument(document);
  return doTransform(document.rootObject, data);
}

function doTransform(meta, data) {
  if (!isPlainObject(data)) {
    if (Array.isArray(data) && meta.type === ObjectType.Entity) {
      throw new Error(`${meta.name} was expected to be an entity, but found an array (operation ${meta.getDocument().operationName})`);
    }
    throw new Error();
  }

  const set = makeCopyOnWriteObjectSetter(data);

  for (const [propName, { transformer }] of Object.entries(meta.scalars)) {
    if (propName in data === false) {
      throw new Error();
    }

    const transformedData = transformer(data[propName]);
    if (data[propName] !== transformedData) {
      data = set(propName, transformedData);
    }
  }

  for (const [propName, object] of Object.entries(meta.objects)) {
    if (object.derivedFromReference || object.derivedFrom) {
      continue;
    }

    if (propName in data === false) {
      throw new Error();
    }

    switch (object.type) {
      case ObjectType.ViewerObject:
      case ObjectType.Wrapper:
      case ObjectType.Entity:
      case ObjectType.Embed:
      case ObjectType.Interface:
        if (data[propName] !== null) {
          const transformedData = doTransform(object, data[propName]);
          if (data[propName] !== transformedData) {
            data = set(propName, transformedData);
          }
        }
        break;

      case ObjectType.EntitySet:
      case ObjectType.EmbedList:
      case ObjectType.InterfaceSet:
        let updated = false;
        const newData =
          data[propName].map((value) => {
            const transformedData = doTransform(object, value);
            updated = updated || (transformedData !== value);
            return transformedData;
          });

        if (updated) {
          data = set(propName, newData);
        }
        break;
    }

    switch (object.type) {
      case ObjectType.Union:
      case ObjectType.Interface:
        if (data[propName] !== null) {
          if (!object.inlineFragments[data[propName].__typename]) {
            if (object.type === ObjectType.Union) {
              const { operationName, operationType } = object.getDocument();
              throw new Error(`inline fragment on '${data[propName].__typename}' for field '${object.name}' missing in the document for operation '${operationType}' with the name '${operationName}'`);
            } else {
              break;
            }
          }
          const transformedData = doTransform(object.inlineFragments[data[propName].__typename], data[propName]);
          if (data[propName] !== transformedData) {
            data = set(propName, transformedData);
          }
        }
        break;

      case ObjectType.UnionSet:
      case ObjectType.InterfaceSet:
        let updated = false;
        const newData =
          data[propName].map((value) => {
            if (!object.inlineFragments[value.__typename]) {
              if (object.type === ObjectType.UnionSet) {
                const { operationName, operationType } = object.getDocument();
                throw new Error(`inline fragment on '${value.__typename}' for field '${object.name}' missing in the document for operation '${operationType}' with the name '${operationName}'`);
              } else {
                return value;
              }
            }
            const transformedData = doTransform(object.inlineFragments[value.__typename], value);
            updated = updated || (transformedData !== value);
            return transformedData;
          });

        if (updated) {
          data = set(propName, newData);
        }
        break;
    }
  }

  return deepFreezePlain(data);
}
