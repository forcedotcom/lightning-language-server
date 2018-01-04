import { Element, api, track } from 'engine';
import { ENTER_KEY, ESCAPE_KEY } from 'c-utils';

/**
 * TodoItem doc
 */
export default class TodoItem extends Element {
    @track
    editing = false;

    @track
    _todo;

    @api
    get todo() {
        return this._todo;
    }

    @api
    set todo(newValue) {
        this.classList[newValue.completed ? "add" : "remove"]("completed");
        this._todo = newValue;
    }

    fireUpdate() {
        const title = this.root.querySelector('input.edit').value.trim();
        const completed = this.root.querySelector('input.toggle').checked;
        const detail = { title, completed };
        const event = new CustomEvent('update', { detail });
        this.dispatchEvent(event);
    }

    fireRemove() {
        const event = new CustomEvent('remove');
        this.dispatchEvent(event);
    }

    handleCompletedInput() {
        this.fireUpdate();
    }

    handleRemoveInput() {
        this.fireRemove();
    }

    handleEditModeInput() {
        this.editing = true;
        // view vs edit elements are toggled via css
        this.classList.add('editing');
    }

    handleBlur() {
        this.editing = false;
        // view vs edit elements are toggled via css
        this.classList.remove('editing');
    }

    handleTitleInput(evt) {
        const title = evt.target.value.trim();
        if (!title) { // remove todo if title is cleared
            this.fireRemove();
            return;
        }
        this.fireUpdate();
    }

    handleKeyDown(evt) {
        const { keyCode } = evt;
        if (keyCode === ENTER_KEY || keyCode === ESCAPE_KEY) {
            const el = this.root.querySelector('input.edit');
            // [esc] cancels the edit
            if (keyCode === ESCAPE_KEY) {
                el.value = this.todo.title;
            }
            // [return] saves the edit
            el.blur();
        }
    }

    renderedCallback() {
        if (this.editing) {
            this.root.querySelector('input.edit').focus();
        }
    }
}