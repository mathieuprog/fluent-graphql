import { isEmptyObjectLiteral, takeProperties } from 'object-array-utils';
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

  if (!isEmptyObjectLiteral(document.variableDefinitions)) {
    str += `(${Object.entries(document.variableDefinitions).map(([name, type]) => `\$${name}:${type}`).join(',')})`;
  }

  const result = doStringify(str, document.rootObject);

  return (result === str + '{ }')
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

    str += `{${Object.keys(object.scalars).join(' ')}`;

    const { filtered: derivedObjects, rejected: nestedObjects } = takeProperties(object.objects, (_key, o) => o.derivedFromForeignKey);

    if (!isEmptyObjectLiteral(derivedObjects)) {
      for (let key in derivedObjects) {
        str += ' ' + derivedObjects[key].derivedFromForeignKey.foreignKey;
      }
    }

    if (!isEmptyObjectLiteral(nestedObjects)) {
      str = doStringify(str + ' ', Object.values(nestedObjects));
    }

    for (let [typename, nestedObject] of Object.entries(object.inlineFragments)) {
      str = doStringify(str + `...on ${typename}`, nestedObject);
    }

    str += '}';
  }

  return str;
}
