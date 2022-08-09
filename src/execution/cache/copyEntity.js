import { filterProperties } from 'object-array-utils';
import ObjectType from '../../document/ObjectType';

export default function copyEntity(meta, entity) {
  const newEntity = filterProperties(entity, ['id', '__typename']);

  const scalars =
    (meta.inlineFragments[entity.__typename])
    ? { ...meta.scalars, ...meta.inlineFragments[entity.__typename].scalars }
    : meta.scalars;

  for (let propName of Object.keys(scalars)) {
    if (propName in entity === false) {
      throw new Error();
    }

    newEntity[propName] = entity[propName];
  }

  const objects =
    (meta.inlineFragments[entity.__typename])
    ? { ...meta.objects, ...meta.inlineFragments[entity.__typename].objects }
    : meta.objects;

  for (const [propName, object] of Object.entries(objects)) {
    if (propName in entity === false) {
      throw new Error();
    }

    switch (object.type) {
      case ObjectType.VIEWER_OBJECT:
      case ObjectType.ROOT_OBJECT:
        throw new Error();

      case ObjectType.EMBED:
      case ObjectType.EMBED_LIST:
        newEntity[propName] = entity[propName];
        break;

      case ObjectType.ENTITY:
      case ObjectType.UNION:
      case ObjectType.INTERFACE:
        newEntity[propName] = (entity[propName] !== null)
          ? copyEntity(object, entity[propName])
          : null;
        break;

      case ObjectType.ENTITY_SET:
      case ObjectType.UNION_SET:
      case ObjectType.INTERFACE_SET:
        newEntity[propName] = entity[propName].map((entity) => copyEntity(object, entity));
        break;
    }
  }

  return newEntity;
}
