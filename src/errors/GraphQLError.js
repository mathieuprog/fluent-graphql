function buildErrorMessage(errorArray) {
  return errorArray.map(({ message }) => message).join("\n");
}

export default class GraphQLError extends Error {
  constructor(errorArray) {
    super(buildErrorMessage(errorArray));
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
