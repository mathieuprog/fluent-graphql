import Document from '../document/Document';
import deriveFrom from './deriveFrom';

test('derive data from other document', async () => {
  const client = {
    request() {
      return {
        organizations: [
          {
            id: 'organization1',
            __typename: 'Organization',
            name: 'Acme 1',
            locations: [{
              id: 'location1',
              __typename: 'Location',
              name: 'Office foo',
              address: 'Foo road'
            }]
          },
          {
            id: 'organization2',
            __typename: 'Organization',
            name: 'Acme 2',
            locations: [{
              id: 'location2',
              __typename: 'Location',
              name: 'Office bar',
              address: 'Bar road'
            }]
          }
        ]
      };
    }
  };

  const otherDocument =
    Document
      .query('document')
        .variableDefinitions({ userId: 'ID!' })
        .entitySet('organizations')
          .useVariables('userId')
          .scalar('name')
          .entitySet('locations')
            .scalar('name')
            .scalar('address')._._._
      .makeExecutable(client);

  const fetchLocations = async (variables) => {
    const data = await otherDocument.execute(variables);
    return data.organizations.flatMap(({ locations }) => locations);
  };

  const document =
    Document
      .query('document')
        .entity('user')
          ._
        .entitySet('locations')
          .deriveFrom(fetchLocations)
          .scalar('address')._._
      .transformResponse(({ locations }) => locations);

  const data = {
    user: {
      id: 'user1',
      __typename: 'User'
    }
  };

  const transformedData = await deriveFrom(document, data, { userId: 1 });

  expect(transformedData.user.id).toBe('user1');
  expect(transformedData.locations.length).toBe(2);
  expect(transformedData.locations[0].id).toBe('location1');
  expect(transformedData.locations[0].address).toBe('Foo road');
  expect(transformedData.locations[0].name).toBeUndefined();
  expect(transformedData.locations[1].id).toBe('location2');
  expect(transformedData.locations[1].address).toBe('Bar road');
  expect(transformedData.locations[1].name).toBeUndefined();

  expect(otherDocument.getExecutor().getCache({ userId: 1 })).toBeTruthy();
  expect(otherDocument.getExecutor().getCache({ userId: 2 })).toBeNull();
  expect(otherDocument.getExecutor().getCache({})).toBeNull();
});
