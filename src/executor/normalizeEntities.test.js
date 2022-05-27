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
            ._._._._;

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
      }
    }
  };

  const entities = normalizeEntities(document, data);

  expect(entities.map(({ id }) => id)).toEqual(['user1', 'appointment1', 'appointment1']);

  expect(entities[0].__meta.objects.appointments.areElementsToBeRemoved).toBeTruthy();
  expect(entities[0].__meta.objects.appointment.areElementsToBeRemoved).toBeFalsy();
});
