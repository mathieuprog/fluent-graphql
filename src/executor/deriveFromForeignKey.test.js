import { deepFreeze } from '../utils';
import Document from '../document/Document';
import deriveFromForeignKey from './deriveFromForeignKey';

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

test('derive data from foreign key', () => {
  const document1 =
    Document.query()
      .entity('user')
        .entity('account')
          .deriveFromForeignKey('accountId', fetchAccount)._
        .entitySet('articles')
          .deriveFromForeignKey('articleIds', fetchArticles)
          .entity('category')
            .deriveFromForeignKey('categoryId', fetchCategory)._._._._;

  const data1 = deepFreeze({
    user: {
      id: 'user1',
      __typename: 'User',
      accountId: 'account1',
      articleIds: ['article1', 'article2', 'article3']
    }
  });

  const transformedData = deriveFromForeignKey(document1, data1);

  expect(transformedData.user.accountId).toBeUndefined();
  expect(transformedData.user.account.id).toBe('account1');

  expect(transformedData.user.articlesIds).toBeUndefined();
  expect(transformedData.user.articles.length).toBe(3);
  expect(transformedData.user.articles[0].id).toBe('article1');
  expect(transformedData.user.articles[0].categoryId).toBeUndefined();
  expect(transformedData.user.articles[0].category.id).toBe('category_article1');
});
