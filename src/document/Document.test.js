import { expect, test } from 'vitest';
import Document from './Document';

test('query: throw if inline fragment doesn\'t contain id', () => {
  expect(() => {
    Document.query('operationName')
      .union('union')
        .onTypedObject('Type1') // __typename but no id
          .entity('account')
            .scalar('name')._._
        .onEntity('Type2')
          .scalar('name')
          .scalar('height')._
        ._._
  }).toThrow();
});
