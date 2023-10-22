import Node from './Node';

export default class InlineFragment extends Node {
  constructor(parent, type, typename, inlineFragmentFactory, document) {
    super(parent, type, null, inlineFragmentFactory, document);
    this._ = parent;
    this.typename = typename;
  }
}
