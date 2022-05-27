import { filterProperties, isObjectLiteral } from '../utils';
import ObjectType from '../document/ObjectType';
import Document from '../document/Document';

export default function normalizeEntities(document, data) {
  if (document instanceof Document === false) {
    throw new Error();
  }

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
    }
  }

  return normalizedEntities;
}

function buildMeta(meta) {
  return { __meta: filterProperties(meta, ['isToBeDeleted', 'scalars', 'objects']) };
}
