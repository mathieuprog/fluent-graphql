import { Temporal } from '@js-temporal/polyfill';
import { beforeEach, expect, test, vi } from 'vitest';
import Document from '../document/Document';
import FetchStrategy from './FetchStrategy';
import OperationExecutor from './OperationExecutor';

beforeEach(() => {
  Document.resetAll();
  Document.instances.length = 0;
});

test('OperationExecutor', async () => {
  const request1 = vi.fn();
  const request2 = vi.fn();
  const request3 = vi.fn();
  const subscriber1 = vi.fn();
  const subscriber2 = vi.fn();
  const subscriber3 = vi.fn();

  const document1 =
    Document
      .query('document1')
        .viewer('me')
          .scalar('int', Number)
          .entity('user', 'User')
            .scalar('name')
            .entitySet('articles', 'Article')
              .scalar('title')._._._._;

  let user1 = {
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

  const operationExecutor1 = new OperationExecutor(document1, client1);

  await operationExecutor1.execute({});
  let unsubscribeSubscriber1 = operationExecutor1.subscribe({}, subscriber1);

  expect(operationExecutor1.getCache({}).me.user.name).toBe('John');
  expect(operationExecutor1.getCache({ var: 1 })).toBeNull();

  expect(request1).toHaveBeenCalledTimes(1);
  expect(subscriber1).toHaveBeenCalledTimes(0);

  const document2 =
    Document
      .query('document2')
        .entitySet('users', 'User')
          .scalar('name')._._;

  user1 = { ...user1, name: 'James' };

  const client2 = {
    request() {
      request2();
      return { users: [user1] };
    }
  };

  const operationExecutor2 = new OperationExecutor(document2, client2);

  await operationExecutor2.execute({ foo: 1 });
  operationExecutor2.subscribe({ foo: 1 }, subscriber2);

  expect(operationExecutor1.getCache({}).me.user.name).toBe('James');
  expect(operationExecutor2.getCache({ foo: 1 }).users[0].name).toBe('James');

  expect(request2).toHaveBeenCalledTimes(1);
  expect(request1).toHaveBeenCalledTimes(1);
  expect(subscriber2).toHaveBeenCalledTimes(0);
  expect(subscriber1).toHaveBeenCalledTimes(1);

  await operationExecutor1.execute({});

  await operationExecutor2.execute({ foo: 1 });

  await operationExecutor2.execute({ foo: 1 });

  expect(operationExecutor1.getCache({}).me.user.name).toBe('James');
  expect(operationExecutor2.getCache({ foo: 1 }).users[0].name).toBe('James');

  expect(request2).toHaveBeenCalledTimes(1);
  expect(request1).toHaveBeenCalledTimes(1);
  expect(subscriber2).toHaveBeenCalledTimes(0);
  expect(subscriber1).toHaveBeenCalledTimes(1);

  user1 = { ...user1, name: 'Jane' };

  await operationExecutor1.execute({});

  await operationExecutor2.execute({ foo: 1 }, { fetchStrategy: FetchStrategy.FetchFromNetwork });

  expect(operationExecutor1.getCache({}).me.user.name).toBe('Jane');
  expect(operationExecutor2.getCache({ foo: 1 }).users[0].name).toBe('Jane');

  expect(request2).toHaveBeenCalledTimes(2);
  expect(request1).toHaveBeenCalledTimes(1);
  expect(subscriber2).toHaveBeenCalledTimes(1);
  expect(subscriber1).toHaveBeenCalledTimes(2);

  await operationExecutor1.execute({ bar: 1 });
  unsubscribeSubscriber1();
  unsubscribeSubscriber1 = operationExecutor1.subscribe({ bar: 1 }, subscriber1);

  expect(operationExecutor1.getCache({}).me.user.name).toBe('Jane');
  expect(operationExecutor1.getCache({ bar: 1 }).me.user.name).toBe('Jane');
  expect(operationExecutor2.getCache({ foo: 1 }).users[0].name).toBe('Jane');

  expect(request2).toHaveBeenCalledTimes(2);
  expect(request1).toHaveBeenCalledTimes(2);
  expect(subscriber2).toHaveBeenCalledTimes(1);
  expect(subscriber1).toHaveBeenCalledTimes(2);

  await operationExecutor1.execute({ baz: 1 });
  unsubscribeSubscriber1();
  operationExecutor1.subscribe({ baz: 1 }, subscriber1);

  expect(operationExecutor1.getCache({}).me.user.name).toBe('Jane');
  expect(operationExecutor1.getCache({ bar: 1 }).me.user.name).toBe('Jane');
  expect(operationExecutor1.getCache({ baz: 1 }).me.user.name).toBe('Jane');
  expect(operationExecutor2.getCache({ foo: 1 }).users[0].name).toBe('Jane');

  expect(request2).toHaveBeenCalledTimes(2);
  expect(request1).toHaveBeenCalledTimes(3);
  expect(subscriber2).toHaveBeenCalledTimes(1);
  expect(subscriber1).toHaveBeenCalledTimes(2);

  user1 = { ...user1, name: 'Jack' };

  const document3 =
    Document
      .query('document3')
        .entitySet('users', 'User')
          .scalar('name')._._;

  const client3 = {
    request() {
      request3();
      return { users: [user1] };
    }
  };

  const operationExecutor3 = new OperationExecutor(document3, client3);

  await operationExecutor3.execute({});
  operationExecutor3.subscribe({}, subscriber3);

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
    Document
      .query('query')
        .viewer('me')
          .entity('user', 'User')
            .scalar('name')._._._
      .transformResponse(({ me }) => me);

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

test('network', async () => {
  const document =
    Document
      .query('query')
        .entity('user', 'User')
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

  const data = await operationExecutor.execute({}, { fetchStrategy: FetchStrategy.FetchFromNetworkAndSkipCaching });

  expect(operationExecutor.getCache({})).toBeNull();

  expect(data.user).toBeTruthy();
});

test('clear and poll', async () => {
  const request1 = vi.fn();

  const document =
    Document
      .query('query')
        .entity('user', 'User')
          .scalar('name')._._
      .destroyIdleAfter(Temporal.Duration.from({ milliseconds: 200 }))
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

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  await sleep(60);

  expect(request1).toHaveBeenCalledTimes(1);
  expect(operationExecutor.getCache({})).toBeTruthy();

  await sleep(100);

  clearInterval(operationExecutor.queryRegistry.get({}).intervalPoll);

  expect(request1).toHaveBeenCalledTimes(2);
  expect(operationExecutor.getCache({})).toBeTruthy();

  await sleep(250);

  expect(operationExecutor.getCache({})).toBeNull();
});
