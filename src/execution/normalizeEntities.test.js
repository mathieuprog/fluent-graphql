import { expect, test } from 'vitest';
import Document from '../document/Document';
import normalizeEntities from './normalizeEntities';

test('normalize entities', () => {
  const document =
    Document.mutation()
      .viewer('me')
        .wrapper('wrapper')
          .entity('user')
            .wrapper('articles')
              .embed('pagination')
                .scalar('cursorForEntriesAfter')
                .scalar('cursorForEntriesBefore')._
              .entitySet('paginatedEntries')
                .scalar('title')
                ._._
            .entitySet('appointments')
              .removeElements()._
            .entity('appointment')
              ._
            .unionSet('unions')
              .onTypedObject('Type1')
                .scalar('foo')._
              .onEntity('Type2')
                .scalar('bar')._._
            .interfaceSet('interfaces')
              .scalar('qux')
              .entity('sharedInterfaceEntity')
                .scalar('dummy')._
              .onEntity('Type4')
                .delete()
                .entity('entity')
                  .scalar('foo')._
                .scalar('bar')._._
            .interface('interface')
              .scalar('baz')
              .entity('sharedInterfaceEntity')
                .scalar('dummy')._
              .onEntity('Type2')
                .scalar('qux')._
              .onEntity('Type3')
                .delete()
                .scalar('quux')._._._._._._;

  const data = {
    me: {
      wrapper: {
        user: {
          id: 'user1',
          __typename: 'User',
          articles: {
            pagination: {
              cursorForEntriesAfter: '20',
              cursorForEntriesBefore: '40'
            },
            paginatedEntries: [
              {
                id: 'article1',
                __typename: 'Article',
                title: 'A title'
              }
            ]
          },
          appointments: [
            {
              id: 'appointment1',
              __typename: 'Appointment'
            }
          ],
          appointment: {
            id: 'appointment1',
            __typename: 'Appointment'
          },
          unions: [
            {
              __typename: 'Type1',
              foo: 'foo'
            },
            {
              id: 'type2',
              __typename: 'Type2',
              bar: 'bar'
            }
          ],
          interfaces: [
            {
              id: 'type4',
              __typename: 'Type4',
              sharedInterfaceEntity: {
                id: 'dummy1',
                __typename: 'Dummy1',
                dummy: 'dummy'
              },
              entity: {
                id: 'entity1',
                __typename: 'Entity1',
                foo: 'foo'
              },
              qux: 'qux',
              bar: 'bar'
            },
            {
              id: 'type10',
              __typename: 'Type10',
              sharedInterfaceEntity: {
                id: 'dummy2',
                __typename: 'Dummy2',
                dummy: 'dummy'
              },
              qux: 'qux'
            }
          ],
          interface: {
            id: 'type20',
            __typename: 'Type20',
            sharedInterfaceEntity: {
              id: 'dummy3',
              __typename: 'Dummy3',
              dummy: 'dummy'
            },
            baz: 'baz'
          },
        }
      }
    }
  };

  const entities = normalizeEntities(document, data);

  expect(entities.map(({ id }) => id)).toEqual(['user1', 'article1', 'appointment1', 'appointment1', 'type2', 'dummy1', 'dummy2', 'type4', 'entity1', 'type10', 'dummy3', 'type20']);

  expect(entities[0].id).toBe('user1');
  expect(entities[0].__meta.objects.appointments.areElementsToBeRemoved).toBeTruthy();
  expect(entities[0].__meta.objects.appointment.areElementsToBeRemoved).toBeFalsy();

  expect(entities[7].id).toBe('type4');
  expect(entities[7].__meta.isToBeDeleted).toBeTruthy();
  expect(entities[9].id).toBe('type10');
  expect(entities[9].__meta.isToBeDeleted).toBeFalsy();
  expect(entities[11].id).toBe('type20');
  expect(entities[11].__meta.isToBeDeleted).toBeFalsy();
});
