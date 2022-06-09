import { jest } from '@jest/globals';
import { Temporal } from '@js-temporal/polyfill';
import Document from '../document/Document';
import FetchStrategy from './FetchStrategy';
import OperationExecutor from './OperationExecutor';

test('OperationExecutor', async () => {
  const request1 = jest.fn();
  const request2 = jest.fn();
  const request3 = jest.fn();
  const subscriber1 = jest.fn();
  const subscriber2 = jest.fn();
  const subscriber3 = jest.fn();
  const returnUnsubscriber1 = jest.fn();
  const returnUnsubscriber2 = jest.fn();
  const returnUnsubscriber3 = jest.fn();

  const document1 =
    Document.query('document1')
      .viewer('me')
        .scalar('int', Number)
        .entity('user')
          .scalar('name')
          .entitySet('articles')
            .scalar('title')
            ._._._._;

  const user1 = {
    id: 'user1',
    __typename: 'User',
    name: 'John',
    articles: [{
      id: 'article1',
      __typename: 'Article',
      title: 'An article'
    }]
  };

  const client1 = {
    request() {
      request1();
      return { me: { int: '1', user: user1 } };
    }
  };

  const operationExecutor1 = new OperationExecutor(document1, client1).unsubscribeOnSubsequentCalls();

  await operationExecutor1.execute({}, subscriber1, returnUnsubscriber1);

  expect(operationExecutor1.getCache({}).me.user.name).toBe('John');
  expect(operationExecutor1.getCache({ var: 1 })).toBeNull();

  expect(request1).toHaveBeenCalledTimes(1);
  expect(subscriber1).toHaveBeenCalledTimes(0);
  expect(returnUnsubscriber1).toHaveBeenCalledTimes(1);

  const document2 =
    Document.query('document2')
      .entitySet('users')
        .scalar('name')._._;

  user1.name = 'James';

  const client2 = {
    request() {
      request2();
      return { users: [user1] };
    }
  };

  const operationExecutor2 = new OperationExecutor(document2, client2).unsubscribeOnSubsequentCalls();

  await operationExecutor2.execute({ foo: 1 }, subscriber2, returnUnsubscriber2);

  expect(operationExecutor1.getCache({}).me.user.name).toBe('James');
  expect(operationExecutor2.getCache({ foo: 1 }).users[0].name).toBe('James');

  expect(request2).toHaveBeenCalledTimes(1);
  expect(request1).toHaveBeenCalledTimes(1);
  expect(subscriber2).toHaveBeenCalledTimes(0);
  expect(subscriber1).toHaveBeenCalledTimes(1);

  await operationExecutor1.execute({}, subscriber1, returnUnsubscriber1);
  await operationExecutor2.execute({ foo: 1 }, subscriber2, returnUnsubscriber2);
  await operationExecutor2.execute({ foo: 1 }, subscriber2, returnUnsubscriber2);

  expect(operationExecutor1.getCache({}).me.user.name).toBe('James');
  expect(operationExecutor2.getCache({ foo: 1 }).users[0].name).toBe('James');

  expect(request2).toHaveBeenCalledTimes(1);
  expect(request1).toHaveBeenCalledTimes(1);
  expect(subscriber2).toHaveBeenCalledTimes(0);
  expect(subscriber1).toHaveBeenCalledTimes(1);

  user1.name = 'Jane';

  await operationExecutor1.execute({}, subscriber1, returnUnsubscriber1);
  await operationExecutor2.execute({ foo: 1 }, subscriber2, returnUnsubscriber2, { fetchStrategy: FetchStrategy.NETWORK_ONLY });

  expect(operationExecutor1.getCache({}).me.user.name).toBe('Jane');
  expect(operationExecutor2.getCache({ foo: 1 }).users[0].name).toBe('Jane');

  expect(request2).toHaveBeenCalledTimes(2);
  expect(request1).toHaveBeenCalledTimes(1);
  expect(subscriber2).toHaveBeenCalledTimes(1);
  expect(subscriber1).toHaveBeenCalledTimes(2);

  await operationExecutor1.execute({ bar: 1 }, subscriber1, returnUnsubscriber1);

  expect(operationExecutor1.getCache({}).me.user.name).toBe('Jane');
  expect(operationExecutor1.getCache({ bar: 1 }).me.user.name).toBe('Jane');
  expect(operationExecutor2.getCache({ foo: 1 }).users[0].name).toBe('Jane');

  expect(request2).toHaveBeenCalledTimes(2);
  expect(request1).toHaveBeenCalledTimes(2);
  expect(subscriber2).toHaveBeenCalledTimes(1);
  expect(subscriber1).toHaveBeenCalledTimes(2);

  await operationExecutor1.execute({ baz: 1 }, subscriber1, returnUnsubscriber1);

  expect(operationExecutor1.getCache({}).me.user.name).toBe('Jane');
  expect(operationExecutor1.getCache({ bar: 1 }).me.user.name).toBe('Jane');
  expect(operationExecutor1.getCache({ baz: 1 }).me.user.name).toBe('Jane');
  expect(operationExecutor2.getCache({ foo: 1 }).users[0].name).toBe('Jane');

  expect(request2).toHaveBeenCalledTimes(2);
  expect(request1).toHaveBeenCalledTimes(3);
  expect(subscriber2).toHaveBeenCalledTimes(1);
  expect(subscriber1).toHaveBeenCalledTimes(2);

  user1.name = 'Jack';

  const document3 =
    Document.query('document3')
      .entitySet('users')
        .scalar('name')._._;

  const client3 = {
    request() {
      request3();
      return { users: [user1] };
    }
  };

  const operationExecutor3 = new OperationExecutor(document3, client3).unsubscribeOnSubsequentCalls();

  await operationExecutor3.execute({}, subscriber3, returnUnsubscriber3);

  expect(operationExecutor1.getCache({}).me.user.name).toBe('Jack');
  expect(operationExecutor1.getCache({ bar: 1 }).me.user.name).toBe('Jack');
  expect(operationExecutor1.getCache({ baz: 1 }).me.user.name).toBe('Jack');
  expect(operationExecutor2.getCache({ foo: 1 }).users[0].name).toBe('Jack');
  expect(operationExecutor3.getCache({}).users[0].name).toBe('Jack');

  expect(request3).toHaveBeenCalledTimes(1);
  expect(request2).toHaveBeenCalledTimes(2);
  expect(request1).toHaveBeenCalledTimes(3);
  expect(subscriber3).toHaveBeenCalledTimes(0);
  expect(subscriber2).toHaveBeenCalledTimes(2);
  expect(subscriber1).toHaveBeenCalledTimes(3);
});

test('transform response', async () => {
  const document =
    Document.query('document')
      .viewer('me')
        .entity('user')
          .scalar('name')._._._
      .transformResponse(({ me: user }) => user);

  const client = {
    request() {
      return {
        me: {
          user: {
            id: 'user1',
            __typename: 'User',
            name: 'John'
          }
        }
      };
    }
  };

  const operationExecutor = new OperationExecutor(document, client);

  const data = await operationExecutor.execute({});

  expect(data.me).toBeUndefined();
  expect(data.user).toBeTruthy();
});

test('no cache', async () => {
  const document =
    Document.query('document')
      .entity('user')
        .scalar('name')._._;

  const client = {
    request() {
      return {
        user: {
          id: 'user1',
          __typename: 'User',
          name: 'John'
        }
      };
    }
  };

  const operationExecutor = new OperationExecutor(document, client);

  const data = await operationExecutor.execute({}, { fetchStrategy: FetchStrategy.NO_CACHE });

  expect(operationExecutor.getCache({})).toBeNull();

  expect(data.user).toBeTruthy();
});

test('standby', async () => {
  const document =
    Document.query('document')
      .entity('user')
        .scalar('name')._._;

  const client = {
    request() {
      return {
        user: {
          id: 'user1',
          __typename: 'User',
          name: 'John'
        }
      };
    }
  };

  const operationExecutor = new OperationExecutor(document, client);

  const data = await operationExecutor.execute({}, { fetchStrategy: FetchStrategy.STANDBY });

  expect(operationExecutor.getCache({})).toBeNull();

  expect(data.user).toBeTruthy();
});

test('clear and poll', async () => {
  const request1 = jest.fn();

  const document =
    Document.query('document')
      .entity('user')
        .scalar('name')._._
      .clearAfter(Temporal.Duration.from({ milliseconds: 200 }))
      .pollAfter(Temporal.Duration.from({ milliseconds: 150 }));

  const client = {
    request() {
      request1();
      return {
        user: {
          id: 'user1',
          __typename: 'User',
          name: 'John'
        }
      };
    }
  };

  const operationExecutor = new OperationExecutor(document, client);

  await operationExecutor.execute({});

  expect(request1).toHaveBeenCalledTimes(1);

  const sleep = (ms) => new Promise((resolve => setTimeout(resolve, ms)));
  await sleep(60);

  expect(request1).toHaveBeenCalledTimes(1);
  expect(operationExecutor.getCache({})).toBeTruthy();

  await sleep(100);

  clearInterval(operationExecutor.getQueryForVars({}).intervalPoll);

  expect(request1).toHaveBeenCalledTimes(2);
  expect(operationExecutor.getCache({})).toBeTruthy();

  await sleep(250);

  expect(operationExecutor.getCache({})).toBeNull();
});
