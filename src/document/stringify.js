import { isEmptyObjectLiteral, takeProperties } from 'object-array-utils';
import OperationType from './OperationType';

export default function stringify(document) {
  let str = '';

  switch (document.operationType) {
    case OperationType.Query:
      if (document.variableDefinitions || document.operationName) {
        str += 'query';
      }
      break;

    case OperationType.Mutation:
      str += 'mutation';
      break;

    case OperationType.Subscription:
      str += 'subscription';
      break;
  }

  if (document.operationName) {
    str += ' ' + document.operationName;
  }

  if (!isEmptyObjectLiteral(document.variableDefinitions)) {
    str += `(${Object.entries(document.variableDefinitions).map(([name, type]) => `\$${name}:${type}`).join(',')})`;
  }

  const result = doStringify(str, document.rootObject);

  return (result === str + '{}')
    ? null
    : result;
}

function doStringify(str, objects) {
  objects = [].concat(objects);

  for (let object of objects) {
    if (object.derivedFrom) {
      continue;
    }

    if (object.name !== null) {
      str += object.name;
    }

    if (!isEmptyObjectLiteral(object.variables)) {
      str += `(${Object.entries(object.variables).map(([name, variable]) => `${name}:\$${variable}`).join(',')})`;
    }

    str += `{`;

    let delimiter = '';
    for (let [name, { variables }] of Object.entries(object.scalars)) {
      str += delimiter + name;
      if (variables && !isEmptyObjectLiteral(variables)) {
        str += `(${Object.entries(variables).map(([name, variable]) => `${name}:\$${variable}`).join(',')})`;
      }
      delimiter = ' ';
    }

    const { filtered: derivedObjects, rejected: nestedObjects } = takeProperties(object.objects, (_key, o) => o.derivedFromForeignKey);

    if (!isEmptyObjectLiteral(derivedObjects)) {
      for (let key in derivedObjects) {
        str += delimiter + derivedObjects[key].derivedFromForeignKey.foreignKey;
        delimiter = ' ';
      }
    }

    if (!isEmptyObjectLiteral(nestedObjects)) {
      str = doStringify(str + delimiter, Object.values(nestedObjects));
    }

    for (let [typename, nestedObject] of Object.entries(object.inlineFragments)) {
      str = doStringify(str + `...on ${typename}`, nestedObject);
    }

    str += '}';
  }

  return str;
}
