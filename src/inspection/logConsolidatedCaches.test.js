import { deepFreeze } from 'object-array-utils';
import { normalizeEntities, normalizeEntity } from './logConsolidatedCaches';

test('normalizeEntity', () => {
  const entity = deepFreeze({
    id: 1,
    __typename: 'Foo',
    foo: 1,
    nestedEntity: {
      id: 2,
      __typename: 'Foo',
      foo: 2,
      deeplyNestedEntity: {
        id: 3,
        __typename: 'Foo',
        foo: 3
      }
    },
    object: {
      foo: 4,
      nestedObject: {
        foo: 5,
        entity: {
          id: 6,
          __typename: 'Foo',
          foo: 6
        }
      }
    },
    array: [
      1,
      {
        id: 7,
        __typename: 'Foo',
        foo: 7,
        nestedEntity: {
          id: 8,
          __typename: 'Foo',
          foo: 8
        }
      },
      {
        foo: 9,
        nestedObject: {
          foo: 10,
          entity: {
            id: 11,
            __typename: 'Foo',
            foo: 11,
            nestedEntity: {
              id: 12,
              __typename: 'Foo',
              foo: 12
            }
          }
        }
      },
      [{
        foo: 14,
        entity: {
          id: 15,
          __typename: 'Foo',
          foo: 15,
          nestedEntity: {
            id: 16,
            __typename: 'Foo',
            foo: 16
          }
        }
      }]
    ]
  });

  const normalizedEntity = normalizeEntity(entity);

  expect(normalizedEntity.nestedEntity.foo).toBeUndefined();
  expect(normalizedEntity.object.nestedObject.foo).toBe(5);
  expect(normalizedEntity.object.nestedObject.entity.foo).toBeUndefined();
  expect(normalizedEntity.array[0]).toBe(1);
  expect(normalizedEntity.array[1].foo).toBeUndefined();
  expect(normalizedEntity.array[2].nestedObject.foo).toBe(10);
  expect(normalizedEntity.array[2].nestedObject.entity.foo).toBeUndefined();
  expect(normalizedEntity.array[3][0].foo).toBe(14);
  expect(normalizedEntity.array[3][0].entity.foo).toBeUndefined();
});

test('normalizeEntities', () => {
  const entity = deepFreeze({
    id: 1,
    __typename: 'Foo',
    foo: 1,
    nestedEntity: {
      id: 2,
      __typename: 'Foo',
      foo: 2,
      deeplyNestedEntity: {
        id: 3,
        __typename: 'Foo',
        foo: 3
      }
    },
    object: {
      foo: 4,
      nestedObject: {
        foo: 5,
        entity: {
          id: 6,
          __typename: 'Foo',
          foo: 6
        }
      }
    },
    array: [
      1,
      {
        id: 7,
        __typename: 'Foo',
        foo: 7,
        nestedEntity: {
          id: 8,
          __typename: 'Foo',
          foo: 8
        }
      },
      {
        foo: 9,
        nestedObject: {
          foo: 10,
          entity: {
            id: 11,
            __typename: 'Foo',
            foo: 11,
            nestedEntity: {
              id: 12,
              __typename: 'Foo',
              foo: 12
            }
          }
        }
      },
      [{
        foo: 14,
        entity: {
          id: 15,
          __typename: 'Foo',
          foo: 15,
          nestedEntity: {
            id: 16,
            __typename: 'Foo',
            foo: 16
          }
        }
      }]
    ]
  });

  const normalizedEntities = normalizeEntities(entity);

  expect(normalizedEntities.length).toBe(10);
  expect(normalizedEntities.every((entity) => entity.foo)).toBeTruthy();
});
