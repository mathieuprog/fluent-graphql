import { expect, test } from 'vitest';
import { deepFreeze } from 'object-array-utils';
import Document from '../../document/Document';
import normalizeEntities from '../normalizeEntities';
import QueryCache from './QueryCache';

test('immutability', () => {
  const document1 =
    Document
      .query()
        .entitySet('articles')
          .scalar('title')
          ._
        .entitySet('articlesUnchanged')
          .scalar('title')
          ._
        .entity('user')
          .scalar('name')
          .entitySet('comments')
            .scalar('text')
            ._
          .entitySet('articles')
            .scalar('title')
            ._._._;

  const data1 = {
    articles: [
      {
        id: 'article1',
        __typename: 'Article',
        title: 'A title'
      },
      {
        id: 'article2',
        __typename: 'Article',
        title: 'Another title'
      }
    ],
    articlesUnchanged: [
      {
        id: 'article1',
        __typename: 'Article',
        title: 'A title'
      },
      {
        id: 'article3',
        __typename: 'Article',
        title: 'Another title'
      }
    ],
    user: {
      id: 'user1',
      __typename: 'User',
      name: 'John',
      comments: [
        {
          id: 'comment1',
          __typename: 'Comment',
          text: 'A comment'
        },
        {
          id: 'comment2',
          __typename: 'Comment',
          text: 'A comment'
        }
      ],
      articles: [
        {
          id: 'article1',
          __typename: 'Article',
          title: 'A title'
        }
      ]
    }
  };

  const queryCache = new QueryCache(document1, data1, {});
  queryCache.data = deepFreeze(queryCache.data);
  queryCache.transformedData = deepFreeze(queryCache.transformedData);

  const articles = queryCache.data.articles;
  const articlesUnchanged = queryCache.data.articlesUnchanged;
  const user = queryCache.data.user;
  const userArticles = queryCache.data.user.articles;
  const userComments = queryCache.data.user.comments;
  const userComment1 = queryCache.data.user.comments[0];
  const userComment2 = queryCache.data.user.comments[1];

  const document2 =
    Document
      .query()
        .entity('comment')
          .scalar('text')
          ._
        .entity('article')
          .scalar('title')
          ._._;

  const data2 = {
    comment: {
      id: 'comment1',
      __typename: 'Comment',
      text: 'Updated comment',
    },
    article: {
      id: 'article2',
      __typename: 'Article',
      title: 'Updated title'
    }
  };

  const entities = normalizeEntities(document2, data2);

  const updated = queryCache.update(entities);
  expect(updated).toBe(true);

  expect(queryCache.data.articlesUnchanged).toBe(articlesUnchanged);
  expect(queryCache.data.articles).not.toBe(articles);
  expect(queryCache.data.user).not.toBe(user);
  expect(queryCache.data.user.comments).not.toBe(userComments);
  expect(queryCache.data.user.articles).toBe(userArticles);
  expect(queryCache.data.user.comments[0]).not.toBe(userComment1);
  expect(queryCache.data.user.comments[1]).toBe(userComment2);
});

test('change value of scalar and embed', () => {
  const document1 =
    Document
      .query()
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
  queryCache.data = deepFreeze(queryCache.data);
  queryCache.transformedData = deepFreeze(queryCache.transformedData);

  expect(queryCache.data.me.user.name).toBe('John');
  expect(queryCache.data.me.user.user.name).toBe('John');
  expect(queryCache.data.me.user.user.embed.foo).toBe(1);

  const document2 =
    Document
      .query()
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

  const updated = queryCache.update(entities);
  expect(updated).toBe(true);

  expect(queryCache.data.me.user.name).toBe('James');
  expect(queryCache.data.me.user.user.name).toBe('James');
  expect(queryCache.data.me.user.user.embed.foo).toBe(2);
});

test('unions and interfaces', () => {
  const document1 =
    Document
      .query()
        .entity('account')
          .scalar('name')._
        .entity('user')
          .scalar('name')
          .union('union')
            .onEntity('Type1')
              .scalar('name')
              .entity('account')
                .scalar('name')._
              .embed('bar')
                .scalar('name')._._
            .onEntity('Type2')
              .scalar('name')
              .scalar('height')._
            ._._
        .interfaceSet('interfaces')
          .scalar('name')
          .onEntity('Type3')
            .entity('account')
              .scalar('name')._
            .scalar('age')._
          .onEntity('Type4')
            .scalar('height')._._._;

  const data1 = {
    account: {
      id: 'account2',
      __typename: 'Account',
    },
    user: {
      id: 'user1',
      __typename: 'User',
      name: 'John',
      union: {
        id: 'type1',
        __typename: 'Type1',
        name: 'union name',
        account: {
          id: 'account1',
          __typename: 'Account',
          name: 'account name'
        },
        bar: {
          name: 'bar name'
        }
      }
    },
    interfaces: [
      {
        id: 'type3',
        __typename: 'Type3',
        name: 'interface 1 name',
        age: 'interface 1 age',
        account: {
          id: 'account2',
          __typename: 'Account',
          name: 'account name'
        },
      },
      {
        id: 'type4',
        __typename: 'Type4',
        name: 'interface 2 name',
        height: 'interface 2 height'
      }
    ]
  };

  const queryCache = new QueryCache(document1, data1, {});
  queryCache.data = deepFreeze(queryCache.data);
  queryCache.transformedData = deepFreeze(queryCache.transformedData);

  expect(queryCache.data.user.name).toBe('John');
  expect(queryCache.data.user.union.id).toBe('type1');
  expect(queryCache.data.user.union.__typename).toBe('Type1');
  expect(queryCache.data.user.union.name).toBe('union name');
  expect(queryCache.data.user.union.account.id).toBe('account1');
  expect(queryCache.data.user.union.account.name).toBe('account name');
  expect(queryCache.data.user.union.bar.name).toBe('bar name');
  expect(queryCache.data.interfaces.length).toBe(2);
  expect(queryCache.data.interfaces[0].name).toBe('interface 1 name');
  expect(queryCache.data.interfaces[0].age).toBe('interface 1 age');
  expect(queryCache.data.interfaces[0].account).toBeTruthy();
  expect(queryCache.data.interfaces[1].name).toBe('interface 2 name');
  expect(queryCache.data.interfaces[1].height).toBe('interface 2 height');

  const document2 =
    Document.mutation()
      .entity('account')
        .delete()._
      .entity('foo')
        .delete()._
      .entitySet('users')
        .scalar('name')
        .union('union')
          .onEntity('Type1')
            .scalar('name')
            .entity('account')
              .scalar('name')._
            .embed('bar')
              .scalar('name')._._
          .onEntity('Type2')
            .scalar('name')
            .scalar('height')._
          ._
        .entitySet('account')
          .scalar('name')._._._;

  const data2 = {
    account: {
      id: 'account2',
      __typename: 'Account'
    },
    foo: {
      id: 'type4',
      __typename: 'Type4'
    },
    users: [{
      id: 'user1',
      __typename: 'User',
      name: 'James',
      union: {
        id: 'type2',
        __typename: 'Type2',
        name: 'updated union name',
        height: 0
      },
      account: [{
        id: 'account1',
        __typename: 'Account',
        name: 'updated account name'
      }]
    }]
  };

  const entities = normalizeEntities(document2, data2);

  const updated = queryCache.update(entities);
  expect(updated).toBe(true);

  expect(queryCache.data.account).toBeNull();
  expect(queryCache.data.user.name).toBe('James');
  expect(queryCache.data.user.union.id).toBe('type2');
  expect(queryCache.data.user.union.__typename).toBe('Type2');
  expect(queryCache.data.user.union.name).toBe('updated union name');
  expect(queryCache.data.interfaces.length).toBe(1);
  expect(queryCache.data.interfaces[0].name).toBe('interface 1 name');
  expect(queryCache.data.interfaces[0].age).toBe('interface 1 age');
  expect(queryCache.data.interfaces[0].account).toBeNull();
});

test('delete entity', () => {
  const document1 =
    Document
      .query()
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
  queryCache.data = deepFreeze(queryCache.data);
  queryCache.transformedData = deepFreeze(queryCache.transformedData);

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

  const updated = queryCache.update(entities);
  expect(updated).toBe(true);

  expect(queryCache.data.user).toBeNull();
});

test('change nested entity', () => {
  const document1 =
    Document
      .query()
        .entity('user')
          .entity('account')
            .scalar('name')._._._;

  const data1 = {
    user: {
      id: 'user1',
      __typename: 'User',
      account: {
        id: 'account1',
        __typename: 'Account',
        name: 'John'
      }
    }
  };

  const queryCache = new QueryCache(document1, data1, {});
  queryCache.data = deepFreeze(queryCache.data);
  queryCache.transformedData = deepFreeze(queryCache.transformedData);

  expect(queryCache.data.user.account.id).toBe('account1');
  expect(queryCache.data.user.account.name).toBe('John');

  const document2 =
    Document
      .query()
        .entity('user')
          .entity('account')
            ._._._;

  const data2 = {
    user: {
      id: 'user1',
      __typename: 'User',
      account: {
        id: 'account2',
        __typename: 'Account',
        name: 'James'
      }
    }
  };

  const entities = normalizeEntities(document2, data2);

  const updated = queryCache.update(entities);
  expect(updated).toBe(true);

  expect(queryCache.data.user.account.id).toBe('account2');
  expect(queryCache.data.user.account.name).toBe('James');
});

test('set nested entity to null/empty array', () => {
  const document1 =
    Document
      .query()
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
  queryCache.data = deepFreeze(queryCache.data);
  queryCache.transformedData = deepFreeze(queryCache.transformedData);

  expect(queryCache.data.user.user).toBeTruthy();
  expect(queryCache.data.user.articles.length).toBe(1);

  const document2 =
    Document
      .query()
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

  const updated = queryCache.update(entities);
  expect(updated).toBe(true);

  expect(queryCache.data.user.user).toBeNull();
  expect(queryCache.data.user.articles.length).toBe(0);
});

test('remove entities from array', () => {
  const document1 =
    Document
      .query()
        .entity('user')
          .entitySet('articles')._._._;

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
  queryCache.data = deepFreeze(queryCache.data);
  queryCache.transformedData = deepFreeze(queryCache.transformedData);

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

  const updated = queryCache.update(entities);
  expect(updated).toBe(true);

  expect(queryCache.data.user.articles.length).toBe(1);
});

test('delete entities from array', () => {
  const document1 =
    Document
      .query()
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
  queryCache.data = deepFreeze(queryCache.data);
  queryCache.transformedData = deepFreeze(queryCache.transformedData);

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

  const updated = queryCache.update(entities);
  expect(updated).toBe(true);

  expect(queryCache.data.article).toBeFalsy();
  expect(queryCache.data.user.article).toBeFalsy();
  expect(queryCache.data.user.articles.length).toBe(1);
});

test('override entities in array', () => {
  const document1 =
    Document
      .query()
        .entity('user')
          .entitySet('articles')._._._;

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
  queryCache.data = deepFreeze(queryCache.data);
  queryCache.transformedData = deepFreeze(queryCache.transformedData);

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

  const updated = queryCache.update(entities);
  expect(updated).toBe(true);

  expect(queryCache.data.user.articles.length).toBe(1);
});

test('add entities in array', () => {
  const document1 =
    Document
      .query()
        .entity('user')
          .entitySet('articles')._._._;

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
  queryCache.data = deepFreeze(queryCache.data);
  queryCache.transformedData = deepFreeze(queryCache.transformedData);

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

  const updated = queryCache.update(entities);
  expect(updated).toBe(true);

  expect(queryCache.data.user.articles.length).toBe(3);
});

test('add entity', () => {
  const document1 =
    Document
      .query()
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
  queryCache.data = deepFreeze(queryCache.data);
  queryCache.transformedData = deepFreeze(queryCache.transformedData);

  expect(queryCache.data.user.organization.id).toBe('organization1');
  expect(queryCache.data.user.organization.locations.map(({ id }) => id)).toEqual(['location1']);

  const document2 =
    Document
      .query()
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

  const updated = queryCache.update(entities);
  expect(updated).toBe(true);

  expect(queryCache.data.user.organization.id).toBe('organization2');
  expect(queryCache.data.user.organization.locations.map(({ id }) => id)).toEqual(['location2', 'location3']);
});

test('filter entity with callback', () => {
  const document1 =
    Document
      .query()
        .variableDefinitions({ minVoteCount: 'Number!' })
        .entity('user')
          .entitySet('articles')
            .useVariables({ minVoteCount: 'minVoteCount' })
            .scalar('voteCount', Number)
            .addEntity({
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
  queryCache.data = deepFreeze(queryCache.data);
  queryCache.transformedData = deepFreeze(queryCache.transformedData);

  expect(queryCache.data.user.articles.length).toBe(1);

  const document2 =
    Document
      .query()
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

  const updated = queryCache.update(entities);
  expect(updated).toBe(true);

  expect(queryCache.data.user.articles.length).toBe(2);
});

test('add entity with callback', () => {
  const document1 =
    Document
      .query()
        .variableDefinitions({ minVoteCount: 'Number!' })
        .entitySet('articles')
          .useVariables({ minVoteCount: 'minVoteCount' })
          .scalar('voteCount', Number)
          .addEntity({
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
  queryCache.data = deepFreeze(queryCache.data);
  queryCache.transformedData = deepFreeze(queryCache.transformedData);

  expect(queryCache.data.articles.length).toBe(1);

  const document2 =
    Document
      .query()
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

  const updated = queryCache.update(entities);
  expect(updated).toBe(true);

  expect(queryCache.data.articles.length).toBe(2);
});

test('replace entity with callback', () => {
  const document1 =
    Document
      .query()
        .variableDefinitions({ accountId: 'ID!' })
        .entity('user')
          .useVariables({ accountId: 'accountId' })
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
  queryCache.data = deepFreeze(queryCache.data);
  queryCache.transformedData = deepFreeze(queryCache.transformedData);

  expect(queryCache.data.user.id).toBe('user1');

  const document2 =
    Document
      .query()
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

  const updated = queryCache.update(entities);
  expect(updated).toBe(true);

  expect(queryCache.data.user.id).toBe('user2');
});

test('no updates', () => {
  const document1 =
    Document
      .query()
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
  queryCache.data = deepFreeze(queryCache.data);
  queryCache.transformedData = deepFreeze(queryCache.transformedData);

  const document2 =
    Document
      .query()
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

  const updated = queryCache.update(entities);
  expect(updated).toBe(false);
});
