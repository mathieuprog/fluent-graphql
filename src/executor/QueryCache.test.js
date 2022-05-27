import Document from '../document/Document';
import normalizeEntities from './normalizeEntities';
import QueryCache from './QueryCache';

test('change value of scalar and embed', () => {
  const document1 =
    Document.query()
      .viewer('me')
        .entity('user')
          .entitySet('articles')
            ._
          .scalar('name')
          .entity('user')
            .scalar('name')
            .embed('embed')
              .scalar('foo')._._._._._;

  const data1 = {
    me: {
      user: {
        id: 'user1',
        __typename: 'User',
        name: 'John',
        user: {
          id: 'user1',
          __typename: 'User',
          name: 'John',
          embed: { foo: 1 }
        },
        articles: [{
          id: 'article1',
          __typename: 'Article',
        }]
      }
    }
  };

  const queryCache = new QueryCache(document1, data1, {});

  expect(queryCache.data.me.user.name).toBe('John');
  expect(queryCache.data.me.user.user.name).toBe('John');
  expect(queryCache.data.me.user.user.embed.foo).toBe(1);

  const document2 =
    Document.query()
      .entitySet('users')
        .entitySet('articles')
          ._
        .entity('user')
          ._
        .scalar('name')
        .embed('embed')
          .scalar('foo')._._._;

  const data2 = {
    users: [{
      id: 'user1',
      __typename: 'User',
      name: 'James',
      embed: { foo: 2 },
      user: {
        id: 'user1',
        __typename: 'User'
      },
      articles: [{
        id: 'article1',
        __typename: 'Article',
      }]
    }]
  };

  const entities = normalizeEntities(document2, data2);

  expect(queryCache.update(entities)).toBeTruthy();

  expect(queryCache.data.me.user.name).toBe('James');
  expect(queryCache.data.me.user.user.name).toBe('James');
  expect(queryCache.data.me.user.user.embed.foo).toBe(2);
});

test('delete entity', () => {
  const document1 =
    Document.query()
      .entity('user')
        .scalar('name')
        .entity('user')
          .scalar('name')._._._;

  const data1 = {
    user: {
      id: 'user1',
      __typename: 'User',
      name: 'John',
      user: {
        id: 'user1',
        __typename: 'User',
        name: 'John'
      }
    }
  };

  const queryCache = new QueryCache(document1, data1, {});

  expect(queryCache.data.user.name).toBe('John');

  const document2 =
    Document.mutation()
      .entitySet('users')
        .deleteElements()
        .scalar('name')._._;

  const data2 = {
    users: [{
      id: 'user1',
      __typename: 'User',
      name: 'James'
    }]
  };

  const entities = normalizeEntities(document2, data2);

  expect(queryCache.update(entities)).toBeTruthy();

  expect(queryCache.data.user).toBeNull();
});

test('set nested entity to null/empty array', () => {
  const document1 =
    Document.query()
      .entity('user')
        .entitySet('articles')
          ._
        .scalar('name')
        .entity('user')
          .scalar('name')._._._;

  const data1 = {
    user: {
      id: 'user1',
      __typename: 'User',
      name: 'John',
      user: {
        id: 'user1',
        __typename: 'User',
        name: 'John'
      },
      articles: [{
        id: 'article1',
        __typename: 'Article',
      }]
    }
  };

  const queryCache = new QueryCache(document1, data1, {});

  expect(queryCache.data.user.user).toBeTruthy();
  expect(queryCache.data.user.articles.length).toBe(1);

  const document2 =
    Document.query()
      .entitySet('users')
        .entitySet('articles')
          .overrideElements()._
        .entity('user')
          ._
        .scalar('name')._._;

  const data2 = {
    users: [{
      id: 'user1',
      __typename: 'User',
      name: 'James',
      user: null,
      articles: []
    }]
  };

  const entities = normalizeEntities(document2, data2);

  expect(queryCache.update(entities)).toBeTruthy();

  expect(queryCache.data.user.user).toBeNull();
  expect(queryCache.data.user.articles.length).toBe(0);
});

test('remove entities from array', () => {
  const document1 =
    Document.query()
      .entity('user')
        .entitySet('articles')
          ._._._;

  const data1 = {
    user: {
      id: 'user1',
      __typename: 'User',
      articles: [
        {
          id: 'article1',
          __typename: 'Article',
        },
        {
          id: 'article2',
          __typename: 'Article',
        }
      ]
    }
  };

  const queryCache = new QueryCache(document1, data1, {});

  expect(queryCache.data.user.articles.length).toBe(2);

  const document2 =
    Document.mutation()
      .entitySet('users')
        .entitySet('articles')
          .removeElements()._._._;

  const data2 = {
    users: [{
      id: 'user1',
      __typename: 'User',
      articles: [
        {
          id: 'article2',
          __typename: 'Article',
        }
      ]
    }]
  };

  const entities = normalizeEntities(document2, data2);

  expect(queryCache.update(entities)).toBeTruthy();

  expect(queryCache.data.user.articles.length).toBe(1);
});

test('delete entities from array', () => {
  const document1 =
    Document.query()
      .entity('article')
        ._
      .entity('user')
        .entity('article')
          ._
        .entitySet('articles')
          ._._._;

  const data1 = {
    article: {
      id: 'article1',
      __typename: 'Article',
    },
    user: {
      id: 'user1',
      __typename: 'User',
      article: {
        id: 'article1',
        __typename: 'Article',
      },
      articles: [
        {
          id: 'article1',
          __typename: 'Article',
        },
        {
          id: 'article2',
          __typename: 'Article',
        }
      ]
    }
  };

  const queryCache = new QueryCache(document1, data1, {});

  expect(queryCache.data.article).toBeTruthy();
  expect(queryCache.data.user.article).toBeTruthy();
  expect(queryCache.data.user.articles.length).toBe(2);

  const document2 =
    Document.mutation()
      .entitySet('users')
        .entitySet('articles')
          .deleteElements()._._._;

  const data2 = {
    users: [{
      id: 'user1',
      __typename: 'User',
      articles: [
        {
          id: 'article1',
          __typename: 'Article',
        }
      ]
    }]
  };

  const entities = normalizeEntities(document2, data2);

  expect(queryCache.update(entities)).toBeTruthy();

  expect(queryCache.data.article).toBeFalsy();
  expect(queryCache.data.user.article).toBeFalsy();
  expect(queryCache.data.user.articles.length).toBe(1);
});

test('override entities in array', () => {
  const document1 =
    Document.query()
      .entity('user')
        .entitySet('articles')
          ._._._;

  const data1 = {
    user: {
      id: 'user1',
      __typename: 'User',
      articles: [
        {
          id: 'article1',
          __typename: 'Article',
        },
        {
          id: 'article2',
          __typename: 'Article',
        }
      ]
    }
  };

  const queryCache = new QueryCache(document1, data1, {});

  expect(queryCache.data.user.articles.length).toBe(2);

  const document2 =
    Document.mutation()
      .entitySet('users')
        .entitySet('articles')
          .overrideElements()._._._;

  const data2 = {
    users: [{
      id: 'user1',
      __typename: 'User',
      articles: [
        {
          id: 'article3',
          __typename: 'Article',
        }
      ]
    }]
  };

  const entities = normalizeEntities(document2, data2);

  expect(queryCache.update(entities)).toBeTruthy();

  expect(queryCache.data.user.articles.length).toBe(1);
});

test('add entities in array', () => {
  const document1 =
    Document.query()
      .entity('user')
        .entitySet('articles')
          ._._._;

  const data1 = {
    user: {
      id: 'user1',
      __typename: 'User',
      articles: [
        {
          id: 'article1',
          __typename: 'Article',
        },
        {
          id: 'article2',
          __typename: 'Article',
        }
      ]
    }
  };

  const queryCache = new QueryCache(document1, data1, {});

  expect(queryCache.data.user.articles.length).toBe(2);

  const document2 =
    Document.mutation()
      .entitySet('users')
        .entitySet('articles')
          ._._._;

  const data2 = {
    users: [{
      id: 'user1',
      __typename: 'User',
      articles: [
        {
          id: 'article3',
          __typename: 'Article',
        }
      ]
    }]
  };

  const entities = normalizeEntities(document2, data2);

  expect(queryCache.update(entities)).toBeTruthy();

  expect(queryCache.data.user.articles.length).toBe(3);
});

test('add entity', () => {
  const document1 =
    Document.query()
      .entity('user')
        .entity('organization')
          .entity('defaultLocation')
            ._
          .entitySet('locations')
            .scalar('address')._
          .scalar('name')._._._;

  const data1 = {
    user: {
      id: 'user1',
      __typename: 'User',
      organization: {
        id: 'organization1',
        __typename: 'Organization',
        name: 'Acme',
        defaultLocation: null,
        locations: [
          {
            id: 'location1',
            __typename: 'Location',
            address: "An address"
          }
        ]
      }
    }
  };

  const queryCache = new QueryCache(document1, data1, {});

  expect(queryCache.data.user.organization.id).toBe('organization1');
  expect(queryCache.data.user.organization.locations.map(({ id }) => id)).toEqual(['location1']);

  const document2 =
    Document.query()
      .entitySet('users')
        .entity('organization')
          .entity('defaultLocation')
            ._
          .entitySet('locations')
            .scalar('address')._
          .scalar('name')._._._;

  const data2 = {
    users: [{
      id: 'user1',
      __typename: 'User',
      organization: {
        id: 'organization2',
        __typename: 'Organization',
        name: 'Foo',
        defaultLocation: {
          id: 'location2',
          __typename: 'Location',
          address: "The address"
        },
        locations: [
          {
            id: 'location2',
            __typename: 'Location',
            address: "The address"
          },
          {
            id: 'location3',
            __typename: 'Location',
            address: "Another address"
          }
        ]
      }
    }]
  };

  const entities = normalizeEntities(document2, data2);

  expect(queryCache.update(entities)).toBeTruthy();

  expect(queryCache.data.user.organization.id).toBe('organization2');
  expect(queryCache.data.user.organization.locations.map(({ id }) => id)).toEqual(['location2', 'location3']);
});

test('filter entity with callback', () => {
  const document1 =
    Document.query()
      .variableDefinitions({ minVoteCount: 'Number!' })
      .entity('user')
        .entitySet('articles')
          .useVariables('minVoteCount')
          .scalar('voteCount', Number)
          .filterEntity({
            Article: (article, { minVoteCount }) => article.voteCount >= minVoteCount
          })._._._;

  const data1 = {
    user: {
      id: 'user1',
      __typename: 'User',
      articles: [{
        id: 'article1',
        __typename: 'Article',
        voteCount: 5
      }]
    }
  };

  const queryCache = new QueryCache(document1, data1, { minVoteCount: 3 });

  expect(queryCache.data.user.articles.length).toBe(1);

  const document2 =
    Document.query()
      .entity('user')
        .entitySet('articles')
          .scalar('voteCount', Number)._._._;

  const data2 = {
    user: {
      id: 'user1',
      __typename: 'User',
      articles: [
        {
          id: 'article2',
          __typename: 'Article',
          voteCount: 6
        },
        {
          id: 'article3',
          __typename: 'Article',
          voteCount: 1
        }
      ]
    }
  };

  const entities = normalizeEntities(document2, data2);

  expect(queryCache.update(entities)).toBeTruthy();

  expect(queryCache.data.user.articles.length).toBe(2);
});

test('add entity with callback', () => {
  const document1 =
    Document.query()
      .variableDefinitions({ minVoteCount: 'Number!' })
      .entitySet('articles')
        .useVariables('minVoteCount')
        .scalar('voteCount', Number)
        .filterEntity({
          Article: (article, { minVoteCount }) => article.voteCount >= minVoteCount
        })._._;

  const data1 = {
    articles: [{
      id: 'article1',
      __typename: 'Article',
      voteCount: 5
    }]
  };

  const queryCache = new QueryCache(document1, data1, { minVoteCount: 3 });

  expect(queryCache.data.articles.length).toBe(1);

  const document2 =
    Document.query()
      .entitySet('articles')
        .scalar('voteCount', Number)._._;

  const data2 = {
    articles: [
      {
        id: 'article2',
        __typename: 'Article',
        voteCount: 6
      },
      {
        id: 'article3',
        __typename: 'Article',
        voteCount: 1
      }
    ]
  };

  const entities = normalizeEntities(document2, data2);

  expect(queryCache.update(entities)).toBeTruthy();

  expect(queryCache.data.articles.length).toBe(2);
});

test('replace entity with callback', () => {
  const document1 =
    Document.query()
      .variableDefinitions({ accountId: 'ID!' })
      .entity('user')
        .useVariables('accountId')
        .scalar('accountId', Number)
        .replaceEntity({
          User: (user, { accountId }) => user.accountId === accountId
        })._._;

  const data1 = {
    user: {
      id: 'user1',
      __typename: 'User',
      accountId: 1
    }
  };

  const queryCache = new QueryCache(document1, data1, { accountId: 1 });

  expect(queryCache.data.user.id).toBe('user1');

  const document2 =
    Document.query()
      .entity('user')
        .scalar('accountId', Number)._._;

  const data2 = {
    user: {
      id: 'user2',
      __typename: 'User',
      accountId: 1
    }
  };

  const entities = normalizeEntities(document2, data2);

  expect(queryCache.update(entities)).toBeTruthy();

  expect(queryCache.data.user.id).toBe('user2');
});

test('no updates', () => {
  const document1 =
    Document.query()
      .viewer('me')
        .entity('user')
          .entitySet('articles')
            .scalar('title')
            ._
          .scalar('name')
          .entity('user')
            .scalar('name')
            .embed('embed')
              .scalar('foo')._._._._._;

  const data1 = {
    me: {
      user: {
        id: 'user1',
        __typename: 'User',
        name: 'John',
        user: {
          id: 'user1',
          __typename: 'User',
          name: 'John',
          embed: { foo: 1 }
        },
        articles: [{
          id: 'article1',
          __typename: 'Article',
          title: 'An article'
        }]
      }
    }
  };

  const queryCache = new QueryCache(document1, data1, {});

  const document2 =
    Document.query()
      .entitySet('users')
        .entitySet('articles')
          .scalar('title')._
        .entity('user')
          .scalar('name')._
        .scalar('name')
        .embed('embed')
          .scalar('foo')._._._;

  const data2 = {
    users: [{
      id: 'user1',
      __typename: 'User',
      name: 'John',
      embed: { foo: 1 },
      user: {
        id: 'user1',
        __typename: 'User',
        name: 'John'
      },
      articles: [{
        id: 'article1',
        __typename: 'Article',
        title: 'An article'
      }]
    }]
  };

  const entities = normalizeEntities(document2, data2);

  expect(queryCache.update(entities)).toBeFalsy();
});
