import { Element, api, track } from 'engine';

export default class TodoUtil extends Element {
    @api
    info;

    @api
    iconName;

    @api
    upperCASE

    @track
    trackProperty;

    privateProperty;

    privateMethod() {
        return 'privateMethod';
    }
}