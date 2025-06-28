import { isPlainObject } from 'object-array-utils';
import Node from './Node';
import ObjectType from './ObjectType';

export default class RootObject extends Node {
  constructor(document, inlineFragmentFactory) {
    super(document, ObjectType.RootObject, null, inlineFragmentFactory, document);
    this.document = document;
  }

  variableDefinitions(variableDefinitions) {
    if (!isPlainObject(variableDefinitions)) {
      throw new Error();
    }

    this.document.variableDefinitions = variableDefinitions;
    return this;
  }
}
