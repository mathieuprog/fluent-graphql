import { isArray, isObjectLiteral } from 'object-array-utils';
import ObjectType from '../document/ObjectType';
import { throwIfNotInstanceOfDocument } from './helpers';

export default function addVirtualScalars(document, data) {
  throwIfNotInstanceOfDocument(document);
  return doAddVirtualScalars(document.rootObject, data);
}

function doAddVirtualScalars(meta, data) {
  if (!isObjectLiteral(data)) {
    if (isArray(data) && meta.type === ObjectType.Entity) {
      throw new Error(`${meta.name} was expected to be an entity, but found an array (operation ${meta.getDocument().operationName})`);
    }
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

  for (const [propName, { initialValue }] of Object.entries(meta.virtualScalars)) {
    if (data[propName] === undefined) {
      data = updatePropImmutably(propName, initialValue);
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
      case ObjectType.ViewerObject:
      case ObjectType.Wrapper:
      case ObjectType.Entity:
      case ObjectType.Embed:
      case ObjectType.Interface:
        if (data[propName] !== null) {
          const transformedData = doAddVirtualScalars(object, data[propName]);
          if (data[propName] !== transformedData) {
            data = updatePropImmutably(propName, transformedData);
          }
        }
        break;

      case ObjectType.EntitySet:
      case ObjectType.EmbedList:
      case ObjectType.InterfaceSet:
        let updated = false;
        const newData =
          data[propName].map((value) => {
            const transformedData = doAddVirtualScalars(object, value);
            updated = updated || (transformedData !== value);
            return transformedData;
          });

        if (updated) {
          data = updatePropImmutably(propName, newData);
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
              throw new Error(`inline fragment on '${value.__typename}' for field '${object.name}' missing in the document for operation '${operationType}' with the name '${operationName}'`);
            } else {
              break;
            }
          }
          const transformedData = doAddVirtualScalars(object.inlineFragments[data[propName].__typename], data[propName]);
          if (data[propName] !== transformedData) {
            data = updatePropImmutably(propName, transformedData);
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
            const transformedData = doAddVirtualScalars(object.inlineFragments[value.__typename], value);
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
