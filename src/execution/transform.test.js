import { deepFreezePlain } from 'object-array-utils';
import { expect, test } from 'vitest';
import Document from '../document/Document';
import transform from './transform';

test('transform', () => {
  const document =
    Document.mutation()
      .viewer('me')
        .wrapper('wrapper')
          .scalar('int', Number)
          .entity('foo')
            .scalar('int', Number)
            .unionSet('union')
              .onTypedObject('Type1')
                .scalar('int', Number)._
              .onEntity('Type2')
                .interface('nestedInterface')
                  .onEntity('Type4')
                    .scalar('int', Number)._._
                .scalar('int', Number)._._
            .interfaceSet('interfaces')
              .scalar('int', Number)
              .onEntity('Type2')
                .scalar('int2', Number)._
              .onEntity('Type3')
                .scalar('int3', Number)._._
            .interface('interface')
              .scalar('int', Number)
              .onEntity('Type2')
                .scalar('int2', Number)._
              .onEntity('Type3')
                .scalar('int3', Number)._._
            .interface('interface2')
              .scalar('int', Number)
              .onEntity('Type2')
                .scalar('int2', Number)._
              .onEntity('Type3')
                .scalar('int3', Number)._._
            .entitySet('bar')
              .scalar('int', Number)._._._._._;

  const data = deepFreezePlain({
    me: {
      wrapper: {
        int: '1',
        foo: {
          id: 'foo1',
          __typename: 'Foo',
          int: '2',
          union: [
            {
              __typename: 'Type1',
              int: '10'
            },
            {
              id: 'type2',
              __typename: 'Type2',
              int: '20',
              nestedInterface: {
                id: 'type4',
                __typename: 'Type4',
                int: '40'
              }
            }
          ],
          interfaces: [
            {
              id: 'type2',
              __typename: 'Type2',
              int: '30',
              int2: '40'
            },
            {
              id: 'type10',
              __typename: 'Type10',
              int: '30'
            }
          ],
          interface: {
            id: 'type2',
            __typename: 'Type2',
            int: '30',
            int2: '40'
          },
          interface2: {
            id: 'type11',
            __typename: 'Type11',
            int: '30'
          },
          bar: [{
            id: 'bar1',
            __typename: 'Bar',
            int: '3'
          }]
        }
      }
    }
  });

  const transformedData = transform(document, data);

  expect(transformedData.me.wrapper.int).toBe(1);
  expect(transformedData.me.wrapper.foo.int).toBe(2);
  expect(transformedData.me.wrapper.foo.bar[0].int).toBe(3);

  expect(transformedData.me.wrapper.foo.union[0].int).toBe(10);
  expect(transformedData.me.wrapper.foo.union[1].int).toBe(20);
  expect(transformedData.me.wrapper.foo.union[1].nestedInterface.int).toBe(40);

  expect(transformedData.me.wrapper.foo.interface.int).toBe(30);
  expect(transformedData.me.wrapper.foo.interface.int2).toBe(40);

  expect(transformedData.me.wrapper.foo.interface2.int).toBe(30);

  expect(transformedData.me.wrapper.foo.interfaces[1].int).toBe(30);
});
