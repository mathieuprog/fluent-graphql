# Fluent GraphQL

* [What?](#what)
* [Why?](#why)
* [How?](#how)
* [Install!](#install)
* [Limitations](#limitations)
* [License](#license)

## What?

Fluent GraphQL is a JavaScript GraphQL client.

The GraphQL document and data handling of the response is expressed through a single fluent API.

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
* Derive data from other queries
* Multiple fetch strategies
* Trivial data transformations
* Cache refresh (polling) and clearing
* TypeScript support

## Why?

Conventionally in other frameworks we would write our GraphQL document as a string:

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

However, this doesn't say anything about how to handle the data received from the server response.

* How do we transform the `age` and `duration` fields into integers?
* Did we receive the full list of services (in which case we have to delete previously fetched services not included in this list from cached data) or do we deal with a non-exhaustive list?
* Is the user to be deleted?
* etcetera

Other frameworks will provide an API allowing to specify how to transform data, how to update the cache, etc. through different framework components.

`fluent-graphql` takes another approach where the GraphQL document itself is expressed through a single fluent API, allowing to specify all transformations, data and cache handling in one go alongside the description of the graph.

## How?

### Instantiate and configure the client

In order to execute requests, we need to instantiate an HTTP client and optionally a WebSocket client:

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

The `Client` constructor receives an object containing an `http` property and `ws` property to configure the HTTP client and WebSocket client respectively.

HTTP requests are executed by the [ky](https://github.com/sindresorhus/ky) library and WebSocket requests by the [graphql-ws](https://github.com/enisdenjo/graphql-ws) library.

The `http` object must contain a `url` property specifying the URL of the API, as well as the settings to apply to the request used by the Fetch API:<br>https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#supplying_request_options

The `ws` object must also contain the `url` property as well as additional properties required by the `createClient` function of `graphql-ws`:<br>
https://github.com/enisdenjo/graphql-ws/blob/master/docs/modules/client.md

The client may also be a promise, which is useful for dealing with CSRF tokens.

<details>
  <summary>Advanced example handling CSRF tokens</summary>

  ```javascript
  import { Client } from 'fluent-graphql';

  const httpUrl = 'http://myapp.localhost:4000/api';

  const csrfTokenResponse = await fetch(`${httpUrl}/csrf`, { credentials: 'include' });
  const csrfToken = await csrfTokenResponse.text();

  const wsUrl = 'ws://myapp.localhost:4000/api/ws?_csrf_token=${csrfToken}';

  const client = new Client({
    http: {
      url: httpUrl,
      credentials: 'include',
      headers: { 'x-csrf-token': csrfToken }
    },
    ws: {
      url: wsUrl
    }
  });

  export default client;
  ```
</details>

### Create a Document instance

Call the static function `query`, `mutation` or `subscription` on the `Document` class in order to create a `Document` instance. Each of these functions take the operation name as argument (optional for queries).

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

You may note the seemingly useless return line and indentation, but it will reveal itself improving readability as we write the document graph.

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

A fluent API allows us to describe the document graph:

* `entity(name)` an object containing `id` and `__typename`
* `entitySet(name)` a list of objects containing `id` and `__typename`
* `scalar(name, transformer)` a string value that we may convert using the `transformer` callback
* `embed(name)` an object containing only scalars or nested embeds, but no entities
* `embedList(name)` a list of embeds
* `union(name)` a union which resolves to an entity or an object with a `__typename`
* `unionSet(name)` a list of unions
* `interface(name)` an interface which resolves to an entity
* `interfaceSet(name)` a list of interfaces
* `onEntity(typename)` used in a union or interface to discriminate by type
* `onTypedObject(typename)` used in a union to discriminate by type

The underscore character `_` refers to the parent object which allows us to navigate back to the parent.

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

When new server data is fetched, caches held by queries may have to be updated. The functions below allow to specify what needs to be changed based on the fetched data:

Delete an entity from caches:

```javascript
Document
  .mutation('DeleteUser')
    .entity('user')
      .delete()._._
  .makeExecutable();
```

Delete a list of entities:

```javascript
Document
  .mutation('DeleteUsers')
    .entitySet('users')
      .deleteElements()._._
  .makeExecutable();
```

Remove entities from an array:

```javascript
Document
  .mutation('RemoveUsersFromOrg')
    .entity('organization')
      .entitySet('users')
        .removeElements()._._._
  .makeExecutable();
```

Remove entities from an array that are not included in the exhaustive list:

```javascript
Document
  .query('OrgUsers')
    .entity('organization')
      .entitySet('users')
        .overrideElements()._._._
  .makeExecutable();
```

When entities are fetched, some entities may need to be added into cached arrays or need to replace some nested entity.

`filterEntity` allows to add a fetched entity into an array of cached entities:

```javascript
Document
  .query('OrgUsers')
    .variableDefinitions({ orgId: 'ID!' })
    .entity('organization')
      .entitySet('users')
        .useVariables({ orgId: 'orgId' })
        .filterEntity({
          User: (user, { orgId }) => user.orgId === org.id
        })._._._
  .makeExecutable();
```

`replaceEntity` allows to replace a nested entity by a newly fetched entity:

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

## Limitations

* IDs must be unique globally (e.g. UUIDs)
* lists of entities are sets, i.e. they may not contain duplicates (may add support for arrays)

## Install!

You can get `fluent-graphql` via [npm](http://npmjs.com).

```
npm install fluent-graphql
```

## License

`fluent-graphql` is distributed under [AGPL-3.0-or-later](LICENSE).

`fluent-graphql` has a commercial-friendly license. You can find the commercial license in COMM-LICENSE.
