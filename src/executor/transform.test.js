import { deepFreeze } from '../utils';
import Document from '../document/Document';
import transform from './transform';

test('normalize entities', () => {
  const document =
    Document.query()
      .viewer('me')
        .scalar('int', Number)
        .entity('foo')
          .scalar('int', Number)
          .entitySet('bar')
            .scalar('int', Number)._._._._;

  const data = deepFreeze({
    me: {
      int: '1',
      foo: {
        id: 'foo1',
        __typename: 'Foo',
        int: '2',
        bar: [{
          id: 'bar1',
          __typename: 'Bar',
          int: '3'
        }]
      }
    }
  });

  const transformedData = transform(document, data);

  expect(transformedData.me.int).toBe(1);
  expect(transformedData.me.foo.int).toBe(2);
  expect(transformedData.me.foo.bar[0].int).toBe(3);
});
