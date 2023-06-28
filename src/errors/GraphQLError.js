function buildErrorMessage(errorArray, operationName, variables) {
  return `error in ${operationName} with variables ${JSON.stringify(variables)}:\n${errorArray.map(({ message }) => message).join("\n")}`;
}

export default class GraphQLError extends Error {
  constructor(errorArray, operationName, variables) {
    super(buildErrorMessage(errorArray, operationName, variables));
    this.name = 'GraphQLError';
    this.graphQLErrors = errorArray;
  }
}

export function findGraphQLError(error, find) {
  if (error instanceof GraphQLError === false) {
    return null;
  }

  return error.graphQLErrors.find(find);
}

export function findGraphQLErrorByCode(error, code) {
  return findGraphQLError(error, (graphQLError) =>  {
    return graphQLError.code === code
        || graphQLError.extensions?.code === code;
  });
}
