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

    if (object.derivedFromForeignKey || object.derivedFrom) {
      continue;
    }

    switch (object.type) {
      case ObjectType.Wrapper:
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
            if (object.type === ObjectType.Union) {
              const { operationName, operationType } = object.getDocument();
              throw new Error(`inline fragment on '${data[propName].__typename}' for field '${object.name}' missing in the document for operation '${operationType}' with the name '${operationName}'`);
            } else {
              normalizedEntities.push({ ...data[propName], ...buildMeta(object) });
              break;
            }
          }
          switch (object.inlineFragments[data[propName].__typename].type) {
            case ObjectType.InlineFragmentEntity:
              if (object.type === ObjectType.Union) {
                normalizedEntities.push({ ...data[propName], ...buildMeta(object.inlineFragments[data[propName].__typename]) });
              } else {
                normalizedEntities.push({ ...data[propName], ...mergeMeta(object, object.inlineFragments[data[propName].__typename]) });
              }
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
            if (object.type === ObjectType.UnionSet) {
              const { operationName, operationType } = object.getDocument();
              throw new Error(`inline fragment on '${value.__typename}' for field '${object.name}' missing in the document for operation '${operationType}' with the name '${operationName}'`);
            } else {
              normalizedEntities.push({ ...value, ...buildMeta(object) });
              return;
            }
          }
          switch (object.inlineFragments[value.__typename].type) {
            case ObjectType.InlineFragmentEntity:
              if (object.type === ObjectType.Union) {
                normalizedEntities.push({ ...value, ...buildMeta(object.inlineFragments[value.__typename]) });
              } else {
                normalizedEntities.push({ ...value, ...mergeMeta(object, object.inlineFragments[value.__typename]) });
              }
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
  return { __meta: filterProperties(meta, ['isToBeDeleted', 'objects', 'scalars']) };
}

function mergeMeta(meta1, meta2) {
  return buildMeta({
    isToBeDeleted: meta2.isToBeDeleted ?? meta1.isToBeDeleted,
    objects: {
      ...meta1.objects,
      ...meta2.objects
    }
  });
}
