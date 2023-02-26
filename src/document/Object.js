import { isObjectLiteral } from 'object-array-utils';
import Document from './Document';
import ObjectType from './ObjectType';
import OperationType from './OperationType';

export default class Object {
  constructor(parent, type, name) {
    // use of _ to refer to parent node was inspired by https://github.com/djeang/parent-chaining
    this._ = parent;
    this.type = type;
    this.name = name;
    this.variables = {};
    this.scalars = {};
    this.inlineFragments = {};
    this.objects = {};
    this.derivedFromForeignKey = null;
    this.derivedFrom = null;
    this.filterFunctionsByTypename = null;
    this.isToBeDeleted = false;
    this.areElementsToBeOverridden = false;
    this.areElementsToBeRemoved = false;
    this.addDefaultScalars(type, parent.type);
  }

  scalar(name, transformer = ((v) => v)) {
    if (name !== '__typename') {
      this.rejectAddingFieldsInUnion();
    }
    this.scalars[name] = { name, transformer };
    return this;
  }

  entity(name) {
    this.rejectAddingEntityInEmbed();
    this.rejectAddingFieldsInUnion();
    return this.object_(name, ObjectType.ENTITY);
  }

  entitySet(name) {
    this.rejectAddingEntityInEmbed();
    this.rejectAddingFieldsInUnion();
    return this.object_(name, ObjectType.ENTITY_SET);
  }

  union(name) {
    this.rejectAddingEntityInEmbed();
    this.rejectAddingFieldsInUnion();
    return this.object_(name, ObjectType.UNION);
  }

  unionSet(name) {
    this.rejectAddingEntityInEmbed();
    this.rejectAddingFieldsInUnion();
    return this.object_(name, ObjectType.UNION_SET);
  }

  interface(name) {
    this.rejectAddingEntityInEmbed();
    this.rejectAddingFieldsInUnion();
    return this.object_(name, ObjectType.INTERFACE);
  }

  interfaceSet(name) {
    this.rejectAddingEntityInEmbed();
    this.rejectAddingFieldsInUnion();
    return this.object_(name, ObjectType.INTERFACE_SET);
  }

  onEntity(typename) {
    this.rejectAddingInlineFragmentInObject();
    const inlineFragment = Document.createInlineFragment(this, ObjectType.INLINE_FRAGMENT_ENTITY, typename);
    this.inlineFragments[typename] = inlineFragment;
    return inlineFragment;
  }

  onTypedObject(typename) {
    this.rejectAddingInlineFragmentInObject();
    this.rejectAddingInlineTypedObjectInQuery();
    const inlineFragment = Document.createInlineFragment(this, ObjectType.INLINE_FRAGMENT_TYPED_OBJECT, typename);
    this.inlineFragments[typename] = inlineFragment;
    return inlineFragment;
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

  useVariables(variables) {
    if (!isObjectLiteral(variables)) {
      throw new Error();
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
    this.filterFunctionsByTypename = filter;
    return this;
  }

  deriveFromForeignKey(foreignKey, fetch) {
    this.derivedFromForeignKey = { foreignKey, fetch };
    return this;
  }

  deriveFrom(fetch) {
    this.derivedFrom = { fetch };
    return this;
  }

  overrideElements() {
    if (![ObjectType.ENTITY_SET, ObjectType.UNION_SET, ObjectType.INTERFACE_SET].includes(this.type)) {
      throw new Error();
    }
    this.areElementsToBeOverridden = true;
    return this;
  }

  removeElements() {
    if (![ObjectType.ENTITY_SET, ObjectType.UNION_SET, ObjectType.INTERFACE_SET].includes(this.type)) {
      throw new Error();
    }
    if (this.getOperationType() !== OperationType.MUTATION) {
      throw new Error();
    }
    this.areElementsToBeRemoved = true;
    return this;
  }

  deleteElements() {
    if (![ObjectType.ENTITY_SET, ObjectType.UNION_SET, ObjectType.INTERFACE_SET].includes(this.type)) {
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
    if (![ObjectType.ENTITY, ObjectType.INLINE_FRAGMENT_ENTITY].includes(this.type)) {
      throw new Error();
    }
    if (this.getOperationType() !== OperationType.MUTATION) {
      throw new Error();
    }
    this.isToBeDeleted = true;
    return this;
  }

  getOperationType() {
    let document = this._;
    while (document instanceof Document === false) {
      document = document._;
    }

    return document.operationType;
  }

  rejectAddingEntityInEmbed() {
    if ([
      ObjectType.EMBED,
      ObjectType.EMBED_LIST
    ].includes(this.type)) {
      throw new Error('embeds may not contain entities');
    }
    if (this.getOperationType() === OperationType.MUTATION) {
      return;
    }
  }

  rejectAddingInlineTypedObjectInQuery() {
    if (this.getOperationType() !== OperationType.MUTATION) {
      throw new Error();
    }
  }

  rejectAddingFieldsInUnion() {
    if ([
      ObjectType.UNION,
      ObjectType.UNION_SET
    ].includes(this.type)) {
      throw new Error('unions may not contain fields outside an inline fragment');
    }
  }

  rejectAddingInlineFragmentInObject() {
    if (![
      ObjectType.UNION,
      ObjectType.UNION_SET,
      ObjectType.INTERFACE,
      ObjectType.INTERFACE_SET
    ].includes(this.type)) {
      throw new Error('inline fragments may only be added into unions or interfaces');
    }
  }

  addDefaultScalars(type, parentType) {
    if ([
      ObjectType.ENTITY,
      ObjectType.ENTITY_SET,
      ObjectType.INTERFACE,
      ObjectType.INTERFACE_SET
    ].includes(type)) {
      this.scalar('id');
      this.scalar('__typename');
      return;
    }

    if ([
      ObjectType.UNION,
      ObjectType.UNION_SET
    ].includes(type)) {
      this.scalar('__typename');
      return;
    }

    if ([
      ObjectType.UNION,
      ObjectType.UNION_SET
    ].includes(parentType) && type === ObjectType.INLINE_FRAGMENT_ENTITY) {
      this.scalar('id');
      return;
    }
  }
}
