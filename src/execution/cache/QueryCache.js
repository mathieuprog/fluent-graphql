import { isObjectLiteral } from 'object-array-utils';
import ObjectType from '../../document/ObjectType';
import { checkInstanceOfDocumentArg } from '../helpers';
import copyEntity from './copyEntity';
import refreshEntity from './refreshEntity';

export default class QueryCache {
  constructor(document, data, variables) {
    checkInstanceOfDocumentArg(document);
    this.document = document;
    this.data = data;
    this.transformedData = document.transform(data);
    this.variables = variables;
  }

  update(freshEntities) {
    const prevData = this.data;

    this.data = this.doUpdate(this.data, this.document.rootObject, freshEntities);

    this.transformedData = this.document.transform(this.data);

    return prevData !== this.data;
  }

  doUpdate(data, meta, freshEntities) {
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

    const objects =
      (data.__typename && meta.inlineFragments[data.__typename])
      ? { ...meta.objects, ...meta.inlineFragments[data.__typename].objects }
      : meta.objects;

    for (const [propName, object] of Object.entries(objects)) {
      if (propName in data === false) {
        throw new Error();
      }

      switch (object.type) {
        case ObjectType.VIEWER_OBJECT:
          const transformedData = this.doUpdate(data[propName], object, freshEntities);
          if (data[propName] !== transformedData) {
            data = updatePropImmutably(propName, transformedData);
          }
          break;

        case ObjectType.ENTITY:
        case ObjectType.UNION:
        case ObjectType.INTERFACE:
          let addedEntity = false;
          if (object.filter) {
            for (let entity of freshEntities) {
              if (
                data[propName]?.id !== entity.id
                && object.filter[entity.__typename]?.(entity, this.variables)
              ) {
                data = updatePropImmutably(propName, copyEntity(object, entity));
                addedEntity = true;
                break;
              }
            }
          }

          if (!addedEntity) {
            if (data[propName] !== null) {
              const transformedData = refreshEntity(data[propName], object, freshEntities, this.variables);
              if (data[propName] !== transformedData) {
                data = updatePropImmutably(propName, transformedData);
              }
            }

            if (data[propName] !== null) {
              const transformedData = this.doUpdate(data[propName], object, freshEntities);
              if (data[propName] !== transformedData) {
                data = updatePropImmutably(propName, transformedData);
              }
            }
          }
          break;

        case ObjectType.ENTITY_SET:
        case ObjectType.UNION_SET:
        case ObjectType.INTERFACE_SET:
          let updated = false;
          const newData =
            data[propName]
              .map((entity) => {
                const transformedData = refreshEntity(entity, object, freshEntities, this.variables);
                updated = updated || (transformedData !== entity);
                return transformedData;
              })
              .filter((entity) => entity)
              .map((entity) => {
                const transformedData = this.doUpdate(entity, object, freshEntities);
                updated = updated || (transformedData !== entity);
                return transformedData;
              });

          if (updated) {
            data = updatePropImmutably(propName, newData);
          }

          if (object.filter) {
            for (let entity of freshEntities) {
              if (
                !data[propName].some(({ id }) => id === entity.id)
                && object.filter[entity.__typename]?.(entity, this.variables)
              ) {
                const entityToAdd = copyEntity(object, entity);
                data = updatePropImmutably(propName, data[propName].concat(entityToAdd));
              }
            }
          }
          break;
      }
    }

    return data;
  }
}
