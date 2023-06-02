import Node from './Node';

export default class InlineFragment extends Node {
  constructor(parent, type, typename) {
    super(parent, type, null);
    this._ = parent;
    this.typename = typename;
  }
}
