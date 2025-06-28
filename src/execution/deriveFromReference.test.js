import { deepFreezePlain } from 'object-array-utils';
import { expect, test } from 'vitest';
import Document from '../document/Document';
import deriveFromReference from './deriveFromReference';

test('derive data from foreign key', async () => {
  const fetchAccount = (accountId) => ({
    id: accountId,
    __typename: 'Account'
  });

  const fetchArticles = (articlesIds) => articlesIds.map((articleId) => ({
    id: articleId,
    __typename: 'Article',
    categoryId: `category_${articleId}`
  }));

  const fetchCategory = (categoryId) => ({
    id: categoryId,
    __typename: 'Category'
  });

  const document =
    Document
      .query()
        .entity('user', 'User')
          .entity('account', 'Account')
            .deriveFromReference('accountId', fetchAccount)._
          .wrapper('wrapper')
            .entitySet('articles', 'Article')
              .deriveFromReference('articleIds', fetchArticles)
              .entity('category', 'Category')
                .deriveFromReference('categoryId', fetchCategory)._._._._._;

  const data = deepFreezePlain({
    user: {
      id: 'user1',
      __typename: 'User',
      accountId: 'account1',
      wrapper: {
        articleIds: ['article1', 'article2', 'article3']
      }
    }
  });

  const transformedData = await deriveFromReference(document, data);

  expect(transformedData.user.accountId).toBeUndefined();
  expect(transformedData.user.account.id).toBe('account1');

  expect(transformedData.user.wrapper.articlesIds).toBeUndefined();
  expect(transformedData.user.wrapper.articles.length).toBe(3);
  expect(transformedData.user.wrapper.articles[0].id).toBe('article1');
  expect(transformedData.user.wrapper.articles[0].categoryId).toBeUndefined();
  expect(transformedData.user.wrapper.articles[0].category.id).toBe('category_article1');
});
