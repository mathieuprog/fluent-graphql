import { isArray, isArrayWhereEvery } from '../utils';
import Document from './Document';
import ObjectType from './ObjectType';
import OperationType from './OperationType';

export default class Object {
  constructor(parent, type, name) {
    // use of _ to refer to parent node was inspired by https://github.com/djeang/parent-chaining
    this._ = parent;
    this.parent = parent;
    this.type = type;
    this.name = name;
    this.variables = [];
    this.scalars = {};
    this.objects = {};
    this.derivedFrom = null;
    this.filter = null;
    this.isToBeDeleted = false;
    this.areElementsToBeOverridden = false;
    this.areElementsToBeRemoved = false;
    if ([ObjectType.ENTITY, ObjectType.ENTITY_SET].includes(type)) {
      this.scalar('id');
      this.scalar('__typename');
    }
  }

  isRoot() {
    return !this.name;
  }

  scalar(name, transformer = ((v) => v)) {
    this.scalars[name] = { name, transformer };
    return this;
  }

  entity(name) {
    if ([ObjectType.EMBED, ObjectType.EMBED_LIST].includes(this.type)) {
      throw new Error('embeds may not contain entities');
    }
    return this.object_(name, ObjectType.ENTITY);
  }

  entitySet(name) {
    if ([ObjectType.EMBED, ObjectType.EMBED_LIST].includes(this.type)) {
      throw new Error('embeds may not contain entities');
    }
    return this.object_(name, ObjectType.ENTITY_SET);
  }

  embed(name) {
    return this.object_(name, ObjectType.EMBED);
  }

  embedList(name) {
    return this.object_(name, ObjectType.EMBED_LIST);
  }

  viewer(name) {
    return this.object_(name, ObjectType.VIEWER_OBJECT);
  }

  object_(name, type) {
    const object = new Object(this, type, name);
    this.objects[name] = object;
    return object;
  }

  useVariables(...variables) {
    if (isArrayWhereEvery(variables, isArray)) {
      if (variables.length > 1) {
        throw new Error();
      }
      variables = variables[0];
    }
    this.variables = variables;
    return this;
  }

  replaceEntity(filter) {
    return this.filterEntity(filter);
  }

  filterEntity(filter) {
    if (filter.typename) {
      filter.typename = [].concat(filter.typename);
    }
    this.filter = filter;
    return this;
  }

  deriveFromForeignKey(foreignKey, fetch) {
    this.derivedFrom = { foreignKey, fetch };
    return this;
  }

  overrideElements() {
    if (this.type !== ObjectType.ENTITY_SET) {
      throw new Error();
    }
    this.areElementsToBeOverridden = true;
    return this;
  }

  removeElements() {
    if (this.type !== ObjectType.ENTITY_SET) {
      throw new Error();
    }
    if (this.getOperationType() !== OperationType.MUTATION) {
      throw new Error();
    }
    this.areElementsToBeRemoved = true;
    return this;
  }

  deleteElements() {
    if (this.type !== ObjectType.ENTITY_SET) {
      throw new Error();
    }
    if (this.getOperationType() !== OperationType.MUTATION) {
      throw new Error();
    }
    this.isToBeDeleted = true;
    this.areElementsToBeRemoved = true;
    return this;
  }

  delete() {
    if (this.type !== ObjectType.ENTITY) {
      throw new Error();
    }
    if (this.getOperationType() !== OperationType.MUTATION) {
      throw new Error();
    }
    this.isToBeDeleted = true;
    return this;
  }

  getOperationType() {
    let document = this.parent;
    while (document instanceof Document === false) {
      document = document.parent;
    }

    return document.operationType;
  }
}
