/**
 * Salesforce-specific extensions to Lightning Web Components
 * (e.g. @wire adapters for salesforce metadata and data)
 */
declare module 'engine' {
    /**
     * Decorator to wire a property or method to the 'record' adapter.
     * Use to get a record's data.
     * @param adapterId 'record' adapter id
     * @param adapterConfig configuration object for the 'record' adapter
     */
    export function wire(
        adapterId: 'record',
        adapterConfig: {
            recordId: string;
            fields: string[];
            optionalFields?: string[];
        },
    ): void;

    /**
     * Decorator to wire a property or method to the 'record-ui' adapter.
     * Use to get layout information, metadata, and data to build UI for a single record or for a collection of records.
     * @param adapterId 'record-ui' adapter id
     * @param adapterConfig configuration object for the 'record-ui' adapter
     */
    export function wire(
        adapterId: 'record-ui',
        adapterConfig: {
            recordIds: string[];
            layoutTypes: ('Compact' | 'Full')[];
            modes: ('Create' | 'Edit' | 'View')[];
            optionalFields?: string[];
        },
    ): void;

    /**
     * Decorator to wire a property or method to the 'object-info' adapter.
     * Use to get metadata about a specific object. The response includes metadata describing fields, child relationships,
     * record type, and theme.
     * @param adapterId 'object-info' adapter id
     * @param adapterConfig configuration object for the 'object-info' adapter
     */
    export function wire(adapterId: 'object-info', adapterConfig: { objectApiName: string }): void;

    /**
     * Decorator to wire a property or method to the 'picklist-values' adapter.
     * Use to get the values of a Picklist or Multipicklist field.
     * @param adapterId 'picklist-values' adapter id
     * @param adapterConfig configuration object for the 'picklist-values' adapter
     */
    export function wire(
        adapterId: 'picklist-values',
        adapterConfig: {
            objectApiName: string;
            recordTypeId: string;
            fieldApiName: string;
        },
    ): void;

    /**
     * Decorator to wire a property or method to the 'record-create-defaults' adapter.
     * Use to get the default layout, object information, and default field values for creating a record.
     * @param adapterId 'record-create-defaults' adapter id
     * @param adapterConfig configuration object for the 'record-create-defaults' adapter
     */
    export function wire(
        adapterId: 'record-create-defaults',
        adapterConfig: {
            apiName: string;
            formFactor?: ('Large' | 'Medium' | 'Small')[];
            recordTypeId?: string;
            optionalFields?: string[];
        },
    ): void;
}
