import InlineFragment from './InlineFragment';

export default class InlineFragmentFactory { // avoid a cyclic dependency error
  constructor(document) {
    this.document = document;
  }

  create(parent, type, typename) {
    return new InlineFragment(parent, type, typename, this, this.document);
  }
}
