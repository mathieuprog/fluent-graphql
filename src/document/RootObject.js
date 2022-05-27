import { isObjectLiteral } from '../utils';
import ObjectType from './ObjectType';
import Object from './Object';

export default class RootObject extends Object {
  constructor(document) {
    super(document, ObjectType.ROOT_OBJECT, null);
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
