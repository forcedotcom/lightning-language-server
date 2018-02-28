import { Element, api } from 'engine';

export default class Line extends Element {
    @api hover;

    internalText;

    @api set text(value) {
        this.internalText = value;
    }

    @api get text() {
        return this.internalText;
    }

    @api focus() {
        this.root.querySelector('p').focus();
    }
}