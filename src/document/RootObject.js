import { isObjectLiteral } from 'object-array-utils';
import ObjectType from './ObjectType';
import Node from './Node';

export default class RootObject extends Node {
  constructor(document) {
    super(document, ObjectType.RootObject, null);
    this.document = document;
  }

  variableDefinitions(variableDefinitions) {
    if (!isObjectLiteral(variableDefinitions)) {
      throw new Error();
    }

    this.document.variableDefinitions = variableDefinitions;
    return this;
  }
}
