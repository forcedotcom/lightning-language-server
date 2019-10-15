declare module 'lightning/messageService' {
    /**
     * Send a message to listeners subscribed to the channel.
     *
     * @param {Object} messageContext - The MessageContext object.
     * @param {Object} messageChannel - MessageChannel object.
     * @param {Object} message - Optional, serializable object to be sent to subscribers.
     * @param {Object} publisherOptions - Optional, options to influence message delivery.
     */
    export function publish(messageContext: Object, memessageChannel: Object, message?: Object, publisherOptions?: Object): void;

    /**
     * Subscribes a listener function to be invoked when a message is published on the provided channel.
     *
     * @param {Object} messageContext - The MessageContext object.
     * @param {Object} messageChannel - MessageChannel object.
     * @param {Function} listener - Function to be invoked when messages are published on the channel.
     * @return {Object} - Subscription object used to unsubscribe the listener, if no longer interested.
     */
    export function subscribe(messageContext: Object, messageChannel: Object, listener: Function): Object;

    /**
     * Unregisters the listener associated with the subscription.
     *
     * @param {Object} subscription - Subscription object returned when subscribing.
     */
    export function unsubscribe(subscription: Object): void;

    /**
     * Creates an anonymous MessageChannel object for use with Message Service.
     *
     * @return {Object} - Anonymous MessageChannel.
     */
    export function createMessageChannel(): Object;

    /**
     * Creates a message context for an LWC library.
     *
     * @return {Object} - MessageContext for use by LWC Library.
     */
    export function createMessageContext(): Object;

    /**
     * Releases a message context associated with LWC library and
     * unsubscribes all associated subscriptions.
     *
     * @param {Object} messageContext - MessageContext for use by LWC Library.
     */
    export function releaseMessageContext(messageContext: Object): void;
}
