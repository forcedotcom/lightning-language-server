/**
 * Salesforce-specific extensions to Lightning Web Components
 * (e.g. @wire adapters for salesforce metadata and data)
 */
declare module 'engine' {

    /**
     * Decorator to wire a property or method to the 'record' adapter
     * @param adapterId 'record' adapter id
     * @param adapterConfig configuration object for the 'record' adapter
     */
    export function wire(adapterId: 'record', adapterConfig: { recordId: string; fields: string[] }): void;

    /**
     * Decorator to wire a property or method to the 'object-info' adapter
     * @param adapterId 'record-ui' adapter id
     * @param adapterConfig configuration object for the 'object-info' adapter
     */
    export function wire(adapterId: 'record-ui', adapterConfig: Object): void;

    /**
     * Decorator to wire a property or method to the 'object-info' adapter
     * @param adapterId 'object-info' adapter id
     * @param adapterConfig configuration object for the 'object-info' adapter
     */
    export function wire(adapterId: 'object-info', adapterConfig: Object): void;

    /**
     * Decorator to wire a property or method to the 'picklist-values' adapter
     * @param adapterId 'picklist-values' adapter id
     * @param adapterConfig configuration object for the 'picklist-values' adapter
     */
    export function wire(adapterId: 'picklist-values', adapterConfig: Object): void;

    /**
     * Decorator to wire a property or method to the 'record-create-defaults' adapter
     * @param adapterId 'record-create-defaults' adapter id
     * @param adapterConfig configuration object for the 'record-create-defaults' adapter
     */
    export function wire(adapterId: 'record-create-defaults', adapterConfig: Object): void;
}
