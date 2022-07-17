import Document from '../document/Document';
import normalizeEntities from './normalizeEntities';

test('normalize entities', () => {
  const document =
    Document.mutation()
      .viewer('me')
        .entity('user')
          .entitySet('appointments')
            .removeElements()._
          .entity('appointment')
            ._
          .unionSet('union')
            .onTypedObject('Type1')
              .scalar('foo')._
            .onEntity('Type2')
              .scalar('bar')._._
          .interface('interface')
            .scalar('baz')
            .onEntity('Type2')
              .scalar('qux')._
            .onEntity('Type3')
              .delete()
              .scalar('quux')._._._._._;

  const data = {
    me: {
      user: {
        id: 'user1',
        __typename: 'User',
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
        union: [
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
        interface: {
          id: 'type3',
          __typename: 'Type3',
          baz: 'baz',
          quux: 'quux'
        },
      }
    }
  };

  const entities = normalizeEntities(document, data);

  expect(entities.map(({ id }) => id)).toEqual(['user1', 'appointment1', 'appointment1', 'type2', 'type3']);

  expect(entities[0].__meta.objects.appointments.areElementsToBeRemoved).toBeTruthy();
  expect(entities[0].__meta.objects.appointment.areElementsToBeRemoved).toBeFalsy();

  expect(entities[3].__meta.isToBeDeleted).toBeFalsy();
  expect(entities[4].__meta.isToBeDeleted).toBeTruthy();
});
