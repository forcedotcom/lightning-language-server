import { Element, api, track } from 'engine';
/** Foo doc */
export default class Foo extends Element {
    _privateTodo;
    @api get todo () {
        return this._privateTodo;
    }
    set todo (val) {
        return this._privateTodo = val;
    }
    @api
    index;

    @api indexSameLine;

    @track
    trackedPrivateIndex;

    onclickAction() {
    }

    @api apiMethod() {
    }

    get privateComputedValue() {
        return null;
    }

    methodWithArguments(a, b) {
    }
}