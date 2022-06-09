import Object from './Object';

export default class InlineFragment extends Object {
  constructor(parent, type, typename) {
    super(parent, type, null);
    this._ = parent;
    this.typename = typename;
  }
}
