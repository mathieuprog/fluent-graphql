import { isEmptyObjectLiteral, isObjectLiteral } from 'object-array-utils';
import ObjectType from './ObjectType';
import OperationType from './OperationType';

function isDocument(o) {
  return !!o.operationType;
}

export default class Node {
  constructor(parent, type, name, inlineFragmentFactory, document) {
    this._ = parent;
    this.document = document;
    this.type = type;
    this.name = name;
    this.inlineFragmentFactory = inlineFragmentFactory;
    this.variables = {};
    this.scalars = {};
    this.virtualScalars = {};
    this.references = {};
    this.inlineFragments = {};
    this.objects = {};
    this.derivedFromReference = null;
    this.derivedFrom = null;
    this.addEntityFiltersByTypename = null;
    this.isToBeDeleted = false;
    this.areElementsToBeReplaced = false;
    this.areElementsToBeRemoved = false;
    this.addDefaultScalars(type, parent.type);
  }

  scalar(name, transformer = ((v) => v), variables) {
    if (name !== '__typename') {
      this.rejectAddingFieldsInUnion();
    }
    if (variables && !isEmptyObjectLiteral(variables) && !isDocument(this._)) {
      throw new Error(`variables can only be accepted by object fields and root fields; "${name}" does not accept variables as it is neither an object field nor a root field`);
    }
    this.scalars[name] = { name, transformer, variables };
    return this;
  }

  virtual(name, initialValue) {
    this.virtualScalars[name] = { name, initialValue };
    return this;
  }

  reference(name, referencedFieldOrTypename, typename) {
    let referencedField = referencedFieldOrTypename;

    if (typename === undefined) {
      typename = referencedFieldOrTypename;

      if (!name.endsWith('Id')) {
        throw new Error();
      }
      referencedField = name.slice(0, -2);
    }

    this.rejectAddingFieldsInUnion();
    this.references[name] = { name, referencedField, typename };
    return this;
  }

  entity(name, possibleTypenames) {
    if (!possibleTypenames && this.getOperationType() !== OperationType.Mutation) {
      throw new Error(`missing argument \`possibleTypenames\` for field "${name}" in "${this.document.operationName}" document: query operations must specify the possible types for entities`);
    }

    this.rejectAddingEntityInEmbed();
    this.rejectAddingFieldsInUnion();
    this.document.addPossibleTypenames([].concat(possibleTypenames));
    return this.object_(name, ObjectType.Entity);
  }

  entitySet(name, possibleTypenames) {
    if (!possibleTypenames && this.getOperationType() !== OperationType.Mutation) {
      throw new Error(`missing argument \`possibleTypenames\` for field "${name}" in "${this.document.operationName}" document: query operations must specify the possible types for entities`);
    }

    this.rejectAddingEntityInEmbed();
    this.rejectAddingFieldsInUnion();
    this.document.addPossibleTypenames([].concat(possibleTypenames));
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
    const inlineFragment = this.inlineFragmentFactory.create(this, ObjectType.InlineFragmentEntity, typename);
    this.inlineFragments[typename] = inlineFragment;
    this.document.addPossibleTypenames([typename]);
    return inlineFragment;
  }

  onTypedObject(typename) {
    this.rejectAddingInlineFragmentInObject();
    const inlineFragment = this.inlineFragmentFactory.create(this, ObjectType.InlineFragmentTypedObject, typename);
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
    const object = new Node(this, type, name, this.inlineFragmentFactory, this.document);
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
    this.addEntityFiltersByTypename = filter;
    return this;
  }

  deriveFromReference(foreignKey, fetch) {
    this.derivedFromReference = { foreignKey, fetch };
    return this;
  }

  deriveFrom(fetch) {
    this.derivedFrom = { fetch };
    return this;
  }

  replaceElements() {
    if (![ObjectType.EntitySet, ObjectType.UnionSet, ObjectType.InterfaceSet].includes(this.type)) {
      throw new Error();
    }
    this.areElementsToBeReplaced = true;
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

  deleteAll() {
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
    return this.document;
  }

  getOperationType() {
    return this.document.operationType;
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
