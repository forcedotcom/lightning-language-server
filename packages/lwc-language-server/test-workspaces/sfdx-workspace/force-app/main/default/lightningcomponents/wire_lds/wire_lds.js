import { Element, track, wire } from 'engine';

const ENTER_KEY = 13;

export default class WireLds extends Element {
    recordId;

    @track
    record = {};

    @wire('record', { recordId: '$recordId', fields: ['Account.Name', 'Account.Phone', 'Account.Industry', 'Account.Description'] })
    wireRecord(error, data) {
        this.record = {};
        if (error) {
          this.record.error = error;
        } else {
          this.record.data = data;
        }
      }

      handleKeyDown(evt) {
        if (evt.keyCode !== ENTER_KEY) {
            return;
        }
        const recId = (evt.target.value || '').trim();
        evt.target.value = '';
        evt.preventDefault();
        this.recordId = recId;
    }
}