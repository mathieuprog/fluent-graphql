import { filterProperties, isObjectLiteral } from 'object-array-utils';
import ObjectType from '../document/ObjectType';
import { throwIfNotInstanceOfDocument } from './helpers';

export default function normalizeEntities(document, data) {
  throwIfNotInstanceOfDocument(document);

  return doNormalizeEntities(document.rootObject, data);
}

function doNormalizeEntities(meta, data, normalizedEntities = []) {
  if (!isObjectLiteral(data)) {
    throw new Error();
  }

  for (const [propName, object] of Object.entries(meta.objects)) {
    if (propName in data === false) {
      throw new Error();
    }

    switch (object.type) {
      case ObjectType.ViewerObject:
        doNormalizeEntities(object, data[propName], normalizedEntities);
        break;

      case ObjectType.Entity:
        if (data[propName] !== null) {
          normalizedEntities.push({ ...data[propName], ...buildMeta(object) });
          doNormalizeEntities(object, data[propName], normalizedEntities);
        }
        break;

      case ObjectType.EntitySet:
        data[propName].forEach((entity) => {
          normalizedEntities.push({ ...entity, ...buildMeta(object) });
          doNormalizeEntities(object, entity, normalizedEntities);
        });
        break;

      case ObjectType.Interface:
        if (data[propName] !== null) {
          doNormalizeEntities(object, data[propName], normalizedEntities);
        }
        break;

      case ObjectType.InterfaceSet:
        data[propName].forEach((value) => {
          doNormalizeEntities(object, value, normalizedEntities);
        });
        break;
    }

    switch (object.type) {
      case ObjectType.Union:
      case ObjectType.Interface:
        if (data[propName] !== null) {
          if (!object.inlineFragments[data[propName].__typename]) {
            throw new Error();
          }
          switch (object.inlineFragments[data[propName].__typename].type) {
            case ObjectType.InlineFragmentEntity:
              normalizedEntities.push({ ...data[propName], ...buildMeta(object.inlineFragments[data[propName].__typename]) });
              doNormalizeEntities(object.inlineFragments[data[propName].__typename], data[propName], normalizedEntities);
              break;

            case ObjectType.InlineFragmentTypedObject:
              doNormalizeEntities(object.inlineFragments[data[propName].__typename], data[propName], normalizedEntities);
              break;
          }
        }
        break;

      case ObjectType.UnionSet:
      case ObjectType.InterfaceSet:
        data[propName].forEach((value) => {
          if (!object.inlineFragments[value.__typename]) {
            throw new Error();
          }
          switch (object.inlineFragments[value.__typename].type) {
            case ObjectType.InlineFragmentEntity:
              normalizedEntities.push({ ...value, ...buildMeta(object.inlineFragments[value.__typename]) });
              doNormalizeEntities(object.inlineFragments[value.__typename], value, normalizedEntities);
              break;

            case ObjectType.InlineFragmentTypedObject:
              doNormalizeEntities(object.inlineFragments[value.__typename], value, normalizedEntities);
              break;
          }
        });
        break;
    }
  }

  return normalizedEntities;
}

function buildMeta(meta) {
  return { __meta: filterProperties(meta, ['isToBeDeleted', 'scalars', 'objects']) };
}
