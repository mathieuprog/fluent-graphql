# Fluent GraphQL

* [What?](#what)
* [Why?](#why)
* [How?](#how)
* [Install!](#install)
* [Limitations](#limitations)

## What?

Fluent GraphQL is a JavaScript GraphQL client.

The GraphQL document and data handling of the response is expressed through a single fluent API.

Fluent GraphQL's approach uses a single fluent API to write GraphQL queries, response processing and cache management, making it easier and more intuitive for developers to work with GraphQL.

```javascript
const document =
  Document
    .query()
      .entity('user')
        .scalar('name')
        .scalar('age', Number)._._
    .makeExecutable();
```

```javascript
const data = await document.execute({});
```

### Features

* Watch for data updates
* Subscriptions using WebSockets
* Compose queries from existing queries
* Multiple fetch strategies
* Trivial data transformations
* TypeScript support
* Cache refresh (polling)
* Cache clearing (free memory)

## Why?

In most other frameworks, GraphQL queries are typically written as strings:

```javascript
const query = `
  query {
    user {
      name
      age
      services {
        name
        duration
      }
    }
  }
`
```

However, this approach does not provide information on how to handle the server response data.

* How do we transform the `age` and `duration` fields into integers?
* Should we replace the existing cached `services` or add to the list?
* If this were a mutation, is the user to be deleted or updated?
* And so on.

Other frameworks offer APIs that allow developers to specify how to transform data, update the cache, and perform other actions through various framework components.

Fluent GraphQL takes a different approach by providing a single fluent API that allows developers to write the GraphQL query, specify all data transformations, and handle caching, all in one go.

## How?

### Instantiate and configure the client

To execute requests using Fluent GraphQL, developers must instantiate an HTTP client and, if needed, a WebSocket client:

```javascript
import { Client } from 'fluent-graphql';

const httpUrl = 'http://myapp.localhost:4000/api';
const wsUrl = 'ws://myapp.localhost:4000/api/ws';

export default new Client({
  http: {
    url: httpUrl,
    credentials: 'include'
  },
  ws: {
    url: wsUrl
  }
});
```

The `Client` constructor receives an object containing an `http` property and `ws` property to configure the HTTP client and WebSocket client, respectively.

HTTP requests are executed by the [ky](https://github.com/sindresorhus/ky) library, while WebSocket requests are handled by the [graphql-ws](https://github.com/enisdenjo/graphql-ws) library.

The `http` object must contain a `url` property specifying the URL of the API, as well as any settings to be applied to the request used by the Fetch API:<br>
https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#supplying_request_options

The `ws` object must also contain the `url` property, as well as any other properties required by the `createClient` function of `graphql-ws`:<br>
https://github.com/enisdenjo/graphql-ws/blob/master/docs/modules/client.md

Developers can also use a Promise as the client, which can be particularly helpful when working with CSRF tokens.

<details>
  <summary>Advanced example handling CSRF tokens</summary>

  ```javascript
  import { Client } from 'fluent-graphql';

  interface ClientURLs {
    httpUrl: string;
    wsUrl: string;
    csrfUrl: string;
  }

  let csrfTokenPromise: Promise<string>;

  export default async function getClient({ httpUrl, wsUrl, csrfUrl }: ClientURLs) {
    if (!csrfTokenPromise) {
      csrfTokenPromise = fetchCsrfToken(csrfUrl);
    }

    const csrfToken = await csrfTokenPromise;

    wsUrl = `${wsUrl}${csrfToken}`;

    return new Client({
      http: {
        url: httpUrl,
        credentials: 'include',
        headers: { 'x-csrf-token': csrfToken }
      },
      ws: {
        url: wsUrl
      }
    });
  }

  async function fetchCsrfToken(csrfUrl: string) {
    const csrfTokenResponse = await fetch(csrfUrl, { credentials: 'include' });
    return await csrfTokenResponse.text();
  }
  ```
</details>

### Create a Document instance

To create a `Document` instance, call the static `query`, `mutation`, or `subscription` function on the `Document` class, passing the operation name as an argument (which is optional for queries).

```javascript
Document
  .query('operationName')
```

```javascript
Document
  .mutation('operationName')
```

```javascript
Document
  .subscription('operationName')
```

While the return line and indentation above may seem superfluous, they are actually important for improving the readability of the document graph when working with a fluent API that involves nested structures.

### Describe the document graph

```javascript
Document
  .query()
    .entity('user')
      .scalar('name')
      .scalar('age', Number)
      .entitySet('services')
        .scalar('name')
        .scalar('duration', Number)._._
    .entity('organization')
      .scalar('name')
      .entitySet('locations')
        .scalar('name')
        .embed('address')
          .scalar('city')
          .scalar('street')._._._._
  .makeExecutable();
```

Once we have a Document instance, we can use the following methods to build our GraphQL document:

* `entity(name)`: an object containing `id` and `__typename`.
* `entitySet(name)`: a list of objects containing `id` and `__typename`.
* `scalar(name, transformer)`: a string value that can be converted using the `transformer` callback.
* `embed(name)`: an object containing only scalars or nested embeds, but no entities.
* `embedList(name)`: a list of embeds.
* `union(name)`: a union which resolves to an entity or an object with a `__typename`.
* `unionSet(name)`: a list of unions.
* `interface(name)`: an interface which resolves to an entity.
* `interfaceSet(name)`: a list of interfaces.
* `onEntity(typename)`: used in a union or interface to discriminate by type.
* `onTypedObject(typename)`: used in a union to discriminate by type.

The character `_` (underscore) character is a reference to the parent object. It allows us to navigate back to the parent level and continue building the document graph from there.

### Declare variables

```javascript
Document
  .query('UserList')
    .variableDefinitions({ organizationId: 'ID!' })
    .entity('users')
      .useVariables({ organizationId: 'organizationId' })
      .scalar('name')._._
  .makeExecutable();
```

### Update query caches

Query caches are updated automatically upon fetching new data. However, there are situations where we need to provide explicit instructions on how to update the caches held by our queries. The following functions provide a way to specify the updates that should be made to the query caches, based on the new data fetched from the server:

#### Delete an entity

The `delete` function allows us to delete an entity from all caches:

```javascript
Document
  .mutation('DeleteUser')
    .entity('user')
      .delete()._._
  .makeExecutable();
```

#### Delete a list of entities

The `deleteElements` function allows us to delete a list of entities from all caches:

```javascript
Document
  .mutation('DeleteUsers')
    .entitySet('users')
      .deleteElements()._._
  .makeExecutable();
```

#### Remove entities from an array

The `removeElements` function allows us to remove entities from a specific array in all caches:

```javascript
Document
  .mutation('RemoveUsersFromOrg')
    .entity('organization')
      .entitySet('users')
        .removeElements()._._._
  .makeExecutable();
```

#### Replace entities in an array

The `overrideElements` function allows us to replace entities from a specific array in all caches:

```javascript
Document
  .query('OrgUsers')
    .entity('organization')
      .entitySet('users')
        .overrideElements()._._._
  .makeExecutable();
```

#### Add entities in an array

`addEntity` allows to add an entity into a specific array:

```javascript
Document
  .query('OrgUsers')
    .variableDefinitions({ orgId: 'ID!' })
    .entity('organization')
      .entitySet('users')
        .useVariables({ orgId: 'orgId' })
        .addEntity({
          User: (user, { orgId }) => user.orgId === org.id
        })._._._
  .makeExecutable();
```

#### Replace entities

`replaceEntity` allows to replace a nested entity:

```javascript
Document
  .query('OrgUsers')
    .variableDefinitions({ orgId: 'ID!' })
    .entity('organization')
      .entity('location')
        .useVariables({ orgId: 'orgId' })
        .replaceEntity({
          Location: (location, { orgId }) => location.orgId === org.id
        })._._._
  .makeExecutable();
```

### Derive data from other documents

```javascript
const fetchAccount = async (accountId, variables) => {
  const data = await otherDocument.execute(variables);
  return data.accounts.find(({ id}) => id === accountId);
};

Document
  .query()
    .entity('user')
      .entity('account')
        .deriveFromForeignKey('accountId', fetchAccount)._._._
  .makeExecutable();
```

```javascript
const fetchAccount = async (variables) => {
  const data = await otherDocument.execute(variables);
  return data.account;
};

Document
  .query()
    .entity('user')
      .entity('account')
        .deriveFrom(fetchAccount)._._._
  .makeExecutable();
```

### Viewer field

```javascript
Document
  .query()
    .viewer('me')
      .entity('articles')
        .scalar('title')._._._
    .makeExecutable();
```

### Cache refresh and clearing

```javascript
Document
  .query()
    .viewer('me')
      .entity('articles')
        .scalar('title')._._._
  .clearAfter(Temporal.Duration.from({ days: 1 }))
  .pollAfter(Temporal.Duration.from({ hours: 1 }));
```

### Clear a document

Unsubscribe all the queries of a document instance from incoming network data:

```javascript
documentInstance.clear();
```

### Development utilities

Here are some utility functions that are useful for development purposes.

### Simulate slower network requests

When developing and running the app locally, network requests tend to execute almost instantaneously. However, in order to simulate a network delay and have a better understanding of the app's behavior under more realistic or poor network conditions, you can use the static function `simulateNetworkDelayGlobally(min, max)`. This function allows you to set a minimum and maximum delay time, which will be randomly applied to network requests throughout the app. This can be useful for testing UI spinners and other app behavior that is dependent on network response times.

```javascript
Document.simulateNetworkDelayGlobally(1000, 3000);
```

The code above adds a delay of a random duration between between 1 and 3 seconds to every network request, simulating network latency.

Example using Vite:

```javascript
if (import.meta.env.DEV) {
  Document.simulateNetworkDelayGlobally(1000, 3000);
}
```

You may also specify the delay for a specific document, which overrides any global configured delay for this document:

```javascript
Document.simulateNetworkDelay(1000, 3000);
```

### Retrieve a document instance from the console

```javascript
FluentGraphQL.document('operationName');
```

### Create a document instance from the console

```javascript
FluentGraphQL
  .query('operationName')
```

```javascript
FluentGraphQL
  .mutation('operationName')
```

```javascript
FluentGraphQL
  .subscription('operationName')
```

### Simulate a network request

```javascript
documentInstance.simulateNetworkRequest(data);
```

### Inspection

```javascript
FluentGraphQL.logStatusQueries();
```

```javascript
FluentGraphQL.logConsolidatedCaches();
```

## Limitations

* The library assumes that IDs are unique globally, therefore, it is recommended to use universally unique identifiers (UUIDs) to ensure uniqueness.

* Lists of entities are treated as sets, which means that they cannot contain duplicates. Currently, the library does not support arrays that hold duplicated entities. However, support for such arrays may be added in the future.

## Install!

You can get `fluent-graphql` via [npm](http://npmjs.com).

```
npm install fluent-graphql
```
