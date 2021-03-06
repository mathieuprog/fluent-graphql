import { filterProperties, isObjectLiteral } from 'object-array-utils';
import ObjectType from '../document/ObjectType';
import { checkInstanceOfDocumentArg } from './helpers';

export default function normalizeEntities(document, data) {
  checkInstanceOfDocumentArg(document);

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
      case ObjectType.VIEWER_OBJECT:
        doNormalizeEntities(object, data[propName], normalizedEntities);
        break;

      case ObjectType.ENTITY:
        if (data[propName] !== null) {
          normalizedEntities.push({ ...data[propName], ...buildMeta(object) });
          doNormalizeEntities(object, data[propName], normalizedEntities);
        }
        break;

      case ObjectType.ENTITY_SET:
        data[propName].forEach((entity) => {
          normalizedEntities.push({ ...entity, ...buildMeta(object) });
          doNormalizeEntities(object, entity, normalizedEntities);
        });
        break;

      case ObjectType.INTERFACE:
        if (data[propName] !== null) {
          doNormalizeEntities(object, data[propName], normalizedEntities);
        }
        break;

      case ObjectType.INTERFACE_SET:
        data[propName].forEach((value) => {
          doNormalizeEntities(object, value, normalizedEntities);
        });
        break;
    }

    switch (object.type) {
      case ObjectType.UNION:
      case ObjectType.INTERFACE:
        if (data[propName] !== null) {
          if (!object.inlineFragments[data[propName].__typename]) {
            throw new Error();
          }
          switch (object.inlineFragments[data[propName].__typename].type) {
            case ObjectType.INLINE_FRAGMENT_ENTITY:
              normalizedEntities.push({ ...data[propName], ...buildMeta(object.inlineFragments[data[propName].__typename]) });
              doNormalizeEntities(object.inlineFragments[data[propName].__typename], data[propName], normalizedEntities);
              break;

            case ObjectType.INLINE_FRAGMENT_TYPED_OBJECT:
              doNormalizeEntities(object.inlineFragments[data[propName].__typename], data[propName], normalizedEntities);
              break;
          }
        }
        break;

      case ObjectType.UNION_SET:
      case ObjectType.INTERFACE_SET:
        data[propName].forEach((value) => {
          if (!object.inlineFragments[value.__typename]) {
            throw new Error();
          }
          switch (object.inlineFragments[value.__typename].type) {
            case ObjectType.INLINE_FRAGMENT_ENTITY:
              normalizedEntities.push({ ...value, ...buildMeta(object.inlineFragments[value.__typename]) });
              doNormalizeEntities(object.inlineFragments[value.__typename], value, normalizedEntities);
              break;

            case ObjectType.INLINE_FRAGMENT_TYPED_OBJECT:
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
