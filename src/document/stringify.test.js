import Document from './Document';

test('stringify', () => {
  const document =
    Document.mutation('operationName')
      .variableDefinitions({ calendarId: 'ID!', dateRange: 'DateRange!' })
      .scalar('foo', Number)
      .entity('user')
        .scalar('name')
        .entity('account')
          .deriveFromForeignKey('accountId')
          .scalar('loggedInAt')._
        .entitySet('appointments')
          .useVariables('calendarId', 'dateRange')
          .scalar('date')
          .scalar('time')
          .embed('bar')
            .scalar('name')._._
        .entitySet('availabilities')
          .useVariables('calendarId', 'dateRange')
          .scalar('date')
          .scalar('time')._._
      .entity('organization')
        .scalar('name')._
      .union('union')
        .onTypedObject('Type1')
          .scalar('name')
          .scalar('age')
          .entity('account')
            .scalar('name')._
          .embed('bar')
            .scalar('name')._._
        .onEntity('Type2')
          .scalar('name')
          .scalar('height')._
        ._
      .interface('interface')
        .scalar('name')
        .onEntity('Type3')
          .scalar('age')._
        .onEntity('Type4')
          .scalar('height')._
        ._._
      .prepareQueryString();

  let expectedDocumentString = 'mutation operationName($calendarId:ID!,$dateRange:DateRange!)';
  expectedDocumentString += '{foo user{';
  expectedDocumentString += 'id __typename name accountId appointments(calendarId:$calendarId,dateRange:$dateRange){';
  expectedDocumentString += 'id __typename date time bar{';
  expectedDocumentString += 'name';
  expectedDocumentString += '}}'; // end bar and appointments
  expectedDocumentString += 'availabilities(calendarId:$calendarId,dateRange:$dateRange){';
  expectedDocumentString += 'id __typename date time';
  expectedDocumentString += '}}'; // end availabilities and user
  expectedDocumentString += 'organization{';
  expectedDocumentString += 'id __typename name';
  expectedDocumentString += '}'; // end organization
  expectedDocumentString += 'union{';
  expectedDocumentString += '__typename';
  expectedDocumentString += '...on Type1{';
  expectedDocumentString += 'name age account{';
  expectedDocumentString += 'id __typename name';
  expectedDocumentString += '}'; // end account
  expectedDocumentString += 'bar{';
  expectedDocumentString += 'name';
  expectedDocumentString += '}}'; // end bar and Type1
  expectedDocumentString += '...on Type2{';
  expectedDocumentString += 'id name height';
  expectedDocumentString += '}}'; // end Type2 and end union
  expectedDocumentString += 'interface{';
  expectedDocumentString += 'id __typename name';
  expectedDocumentString += '...on Type3{';
  expectedDocumentString += 'age';
  expectedDocumentString += '}'; // end Type3
  expectedDocumentString += '...on Type4{';
  expectedDocumentString += 'height';
  expectedDocumentString += '}}}'; // end Type4, interface and root object

  expect(document.queryString).toBe(expectedDocumentString);
});
