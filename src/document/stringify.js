import { isEmptyArray, isEmptyObjectLiteral, takeProperties } from '../utils';
import OperationType from './OperationType';

export default function stringify(document) {
  let str = '';

  switch (document.operationType) {
    case OperationType.QUERY:
      if (document.variableDefinitions || document.operationName) {
        str += 'query';
      }
      break;

    case OperationType.MUTATION:
      str += 'mutation';
      break;

    case OperationType.SUBSCRIPTION:
      str += 'subscription';
      break;
  }

  if (document.operationName) {
    str += ' ' + document.operationName;
  }

  if (document.variableDefinitions) {
    str += `(${Object.entries(document.variableDefinitions).map(([name, type]) => `\$${name}:${type}`).join(',')})`;
  }

  return doStringify(str, [document.rootObject]);
}

function doStringify(str, objects) {
  for (let [fieldName, object] of Object.entries(objects)) {
    if (!object.isRoot()) {
      str += fieldName;

      if (!isEmptyArray(object.variables)) {
        str += `(${object.variables.map((variable) => `${variable}:\$${variable}`).join(',')})`;
      }
    }

    str += `{${Object.keys(object.scalars).join(' ')}`;

    const { filtered: derivedObjects, rejected: objects } = takeProperties(object.objects, (_key, o) => o.derivedFrom);

    if (!isEmptyObjectLiteral(derivedObjects)) {
      for (let key in derivedObjects) {
        str += ' ' + derivedObjects[key].derivedFrom.foreignKey;
      }
    }

    if (!isEmptyObjectLiteral(objects)) {
      str = doStringify(str + ' ', objects);
    }

    str += '}';
  }

  return str;
}
