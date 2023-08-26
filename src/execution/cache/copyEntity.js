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
      throw new Error(`new ${entity.__typename} entity to be added in ${meta.getDocument().operationName} query cache but field ${propName} is missing`);
    }

    newEntity[propName] = entity[propName];
  }

  const objects =
    (meta.inlineFragments[entity.__typename])
    ? { ...meta.objects, ...meta.inlineFragments[entity.__typename].objects }
    : meta.objects;

  for (const [propName, object] of Object.entries(objects)) {
    if (propName in entity === false) {
      throw new Error(`new ${entity.__typename} entity to be added in ${meta.getDocument().operationName} query cache but field ${propName} is missing`);
    }

    switch (object.type) {
      case ObjectType.ViewerObject:
      case ObjectType.RootObject:
        throw new Error();

      case ObjectType.Embed:
      case ObjectType.EmbedList:
        newEntity[propName] = entity[propName];
        break;

      case ObjectType.Entity:
      case ObjectType.Union:
      case ObjectType.Interface:
      case ObjectType.Wrapper:
        newEntity[propName] = (entity[propName] !== null)
          ? copyEntity(object, entity[propName])
          : null;
        break;

      case ObjectType.EntitySet:
      case ObjectType.UnionSet:
      case ObjectType.InterfaceSet:
        newEntity[propName] = entity[propName].map((entity) => copyEntity(object, entity));
        break;
    }
  }

  return newEntity;
}
