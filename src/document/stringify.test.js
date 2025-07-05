import { beforeEach, expect, test } from 'vitest';
import Document from './Document';

beforeEach(() => {
  Document.resetAll();
  Document.instances.length = 0;
});

test('stringify', () => {
  const document =
    Document.mutation('operationName')
      .variableDefinitions({ calendarId: 'ID!', dateRange: 'DateRange!', cursor: 'String!' })
      .scalar('foo', Number, { calendarId: 'calendarId', dateRange: 'dateRange' })
      .entity('user', 'User')
        .scalar('name')
        .reference('quxId', 'Qux')
        .entity('account', 'Account')
          .deriveFromReference('accountId')
          .scalar('loggedInAt')._
        .wrapper('appointments')
          .useVariables({ calendarId: 'calendarId', dateRange: 'dateRange', cursor: 'cursor' })
          .embed('pagination')
            .scalar('cursorForEntriesAfter')
            .scalar('cursorForEntriesBefore')._
          .entitySet('paginatedEntries', 'Appointment')
            .scalar('date')
            .scalar('time')
            .embed('bar')
              .scalar('name')._._._
        .entitySet('availabilities', 'Availability')
          .useVariables({ calendarId: 'calendarId', dateRange: 'dateRange' })
          .scalar('date')
          .scalar('time')._._
      .entity('organization', 'Organization')
        .scalar('name')._
      .union('union')
        .onTypedObject('Type1')
          .scalar('name')
          .scalar('age')
          .entity('account', 'Account')
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

  let expectedDocumentString = 'mutation operationName($calendarId:ID!,$dateRange:DateRange!,$cursor:String!)';
  expectedDocumentString += '{foo(calendarId:$calendarId,dateRange:$dateRange) user{';
  expectedDocumentString += 'id __typename name quxId accountId appointments(calendarId:$calendarId,dateRange:$dateRange,cursor:$cursor){';
  expectedDocumentString += 'pagination{';
  expectedDocumentString += 'cursorForEntriesAfter cursorForEntriesBefore';
  expectedDocumentString += '}';
  expectedDocumentString += 'paginatedEntries{';
  expectedDocumentString += 'id __typename date time bar{';
  expectedDocumentString += 'name';
  expectedDocumentString += '}}}'; // end bar and paginatedEntries and appointments
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

test('stringify returns null', () => {
  const document2 =
    Document
      .query('Services')
        .entitySet('services', 'Service')
          .deriveFrom(() => ({}))
          .scalar('foo')._._
      .prepareQueryString();

  expect(document2.queryString).toBe(null);

  const document3 =
    Document
      .query('query')
        .entitySet('services', 'Service')
          .deriveFrom(() => ({}))
          .scalar('foo')._._
      .prepareQueryString();

  expect(document3.queryString).toBe(null);
});
