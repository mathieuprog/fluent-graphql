import { isArray, isObjectLiteral, rejectProperties } from 'object-array-utils';
import ObjectType from '../document/ObjectType';
import { throwIfNotInstanceOfDocument } from './helpers';

export default function reference(document, data) {
  throwIfNotInstanceOfDocument(document);
  return doReference(document.rootObject, data);
}

const updatePropImmutablyFun = ((original) => {
  let data = original;
  return (prop, value) => {
    data = (original === data) ? { ...data } : data;
    data[prop] = value;
    return data;
  };
});

function doReference(meta, data) {
  if (!isObjectLiteral(data)) {
    if (isArray(data) && meta.type === ObjectType.Entity) {
      throw new Error(`${meta.name} was expected to be an entity, but found an array (operation ${meta.getDocument().operationName})`);
    }
    throw new Error();
  }

  let updatePropImmutably = updatePropImmutablyFun(data);

  for (const [propName, { referencedField, typename }] of Object.entries(meta.references)) {
    if (propName in data === false) {
      throw new Error();
    }

    data = updatePropImmutably(referencedField, { id: data[propName], __typename: typename });
    data = rejectProperties(data, [propName]);
    updatePropImmutably = updatePropImmutablyFun(data);
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
          const transformedData = doReference(object, data[propName]);
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
            const transformedData = doReference(object, value);
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
              throw new Error(`inline fragment on '${data[propName].__typename}' for field '${object.name}' missing in the document for operation '${operationType}' with the name '${operationName}'`);
            } else {
              break;
            }
          }
          const transformedData = doReference(object.inlineFragments[data[propName].__typename], data[propName]);
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
            const transformedData = doReference(object.inlineFragments[value.__typename], value);
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
