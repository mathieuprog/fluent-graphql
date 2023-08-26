import { isEmptyObjectLiteral, isObjectLiteral } from 'object-array-utils';
import Document from './Document';
import ObjectType from './ObjectType';
import OperationType from './OperationType';

export default class Node {
  constructor(parent, type, name) {
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

  scalar(name, transformer = ((v) => v), variables) {
    if (name !== '__typename') {
      this.rejectAddingFieldsInUnion();
    }
    if (variables && !isEmptyObjectLiteral(variables) && (this._ instanceof Document === false)) {
      throw new Error(`variables can only be accepted by object fields and root fields; "${name}" does not accept variables as it is neither an object field nor a root field`);
    }
    this.scalars[name] = { name, transformer, variables };
    return this;
  }

  entity(name) {
    this.rejectAddingEntityInEmbed();
    this.rejectAddingFieldsInUnion();
    return this.object_(name, ObjectType.Entity);
  }

  entitySet(name) {
    this.rejectAddingEntityInEmbed();
    this.rejectAddingFieldsInUnion();
    return this.object_(name, ObjectType.EntitySet);
  }

  union(name) {
    this.rejectAddingEntityInEmbed();
    this.rejectAddingFieldsInUnion();
    return this.object_(name, ObjectType.Union);
  }

  unionSet(name) {
    this.rejectAddingEntityInEmbed();
    this.rejectAddingFieldsInUnion();
    return this.object_(name, ObjectType.UnionSet);
  }

  interface(name) {
    this.rejectAddingEntityInEmbed();
    this.rejectAddingFieldsInUnion();
    return this.object_(name, ObjectType.Interface);
  }

  interfaceSet(name) {
    this.rejectAddingEntityInEmbed();
    this.rejectAddingFieldsInUnion();
    return this.object_(name, ObjectType.InterfaceSet);
  }

  wrapper(name) {
    this.rejectAddingEntityInEmbed();
    this.rejectAddingFieldsInUnion();
    return this.object_(name, ObjectType.Wrapper);
  }

  onEntity(typename) {
    this.rejectAddingInlineFragmentInObject();
    const inlineFragment = Document.createInlineFragment(this, ObjectType.InlineFragmentEntity, typename);
    this.inlineFragments[typename] = inlineFragment;
    return inlineFragment;
  }

  onTypedObject(typename) {
    this.rejectAddingInlineFragmentInObject();
    const inlineFragment = Document.createInlineFragment(this, ObjectType.InlineFragmentTypedObject, typename);
    this.inlineFragments[typename] = inlineFragment;
    return inlineFragment;
  }

  embed(name) {
    return this.object_(name, ObjectType.Embed);
  }

  embedList(name) {
    return this.object_(name, ObjectType.EmbedList);
  }

  viewer(name) {
    return this.object_(name, ObjectType.ViewerObject);
  }

  object_(name, type) {
    const object = new Node(this, type, name);
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
    return this.addEntity(filter);
  }

  addEntity(filter) {
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
    if (![ObjectType.EntitySet, ObjectType.UnionSet, ObjectType.InterfaceSet].includes(this.type)) {
      throw new Error();
    }
    this.areElementsToBeOverridden = true;
    return this;
  }

  removeElements() {
    if (![ObjectType.EntitySet, ObjectType.UnionSet, ObjectType.InterfaceSet].includes(this.type)) {
      throw new Error();
    }
    if (this.getOperationType() !== OperationType.Mutation) {
      throw new Error();
    }
    this.areElementsToBeRemoved = true;
    return this;
  }

  deleteElements() {
    if (![ObjectType.EntitySet, ObjectType.UnionSet, ObjectType.InterfaceSet].includes(this.type)) {
      throw new Error();
    }
    if (this.getOperationType() !== OperationType.Mutation) {
      throw new Error();
    }
    this.isToBeDeleted = true;
    this.areElementsToBeRemoved = true;
    return this;
  }

  delete() {
    if (![ObjectType.Entity, ObjectType.InlineFragmentEntity].includes(this.type)) {
      throw new Error();
    }
    if (this.getOperationType() !== OperationType.Mutation) {
      throw new Error();
    }
    this.isToBeDeleted = true;
    return this;
  }

  getDocument() {
    let document = this._;
    while (document instanceof Document === false) {
      document = document._;
    }

    return document;
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
      ObjectType.Embed,
      ObjectType.EmbedList
    ].includes(this.type)) {
      throw new Error('embeds may not contain entities or wrappers');
    }
    if (this.getOperationType() === OperationType.Mutation) {
      return;
    }
  }

  rejectAddingFieldsInUnion() {
    if ([
      ObjectType.Union,
      ObjectType.UnionSet
    ].includes(this.type)) {
      throw new Error('unions may not contain fields outside an inline fragment');
    }
  }

  rejectAddingInlineFragmentInObject() {
    if (![
      ObjectType.Union,
      ObjectType.UnionSet,
      ObjectType.Interface,
      ObjectType.InterfaceSet
    ].includes(this.type)) {
      throw new Error('inline fragments may only be added into unions or interfaces');
    }
  }

  addDefaultScalars(type, parentType) {
    if ([
      ObjectType.Entity,
      ObjectType.EntitySet,
      ObjectType.Interface,
      ObjectType.InterfaceSet
    ].includes(type)) {
      this.scalar('id');
      this.scalar('__typename');
      return;
    }

    if ([
      ObjectType.Union,
      ObjectType.UnionSet
    ].includes(type)) {
      this.scalar('__typename');
      return;
    }

    if ([
      ObjectType.Union,
      ObjectType.UnionSet
    ].includes(parentType) && type === ObjectType.InlineFragmentEntity) {
      this.scalar('id');
      return;
    }
  }
}
