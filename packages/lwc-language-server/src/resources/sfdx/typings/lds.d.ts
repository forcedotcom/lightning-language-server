/**
 * JavaScript API to Create and Update Records
 */
declare module 'lightning-lds-records' {
    /**
     * The field data, API name, child relationship data, and record type information for a record.
     */
    class Record {
        /** The record's API name */
        apiName: string;
        /** The ID of this record */
        id: string;
        /** The field data for this record, matching the requested layout and mode */
        fields: { [name: string]: FieldValue };
        /** The child relationship data for this record */
        childRelationships: { [name: string]: childRelationship };
        /** The record type info for this record, if any */
        recordTypeInfo: RecordTypeInfo;
    }

    /**
     * A description of a record to use in a request to create or update a record.
     */
    class RecordInput {
        /** Object API name of the record to create, or null to update a record */
        apiName: string;
        /** Map of field names to field values */
        fields: { [name: string]: any };
    }

    /**
     * The raw and displayable field values for a field in record.
     */
    class FieldValue {
        /** The displayable value for a field */
        displayValue: string;
        /** The value of a field in its raw data form */
        value: any;
    }

    /**
     * The child relationship on a parent object.
     */
    class childRelationship {
        /** The API name of the child object */
        childObjectApiName: string;
        /** The field on the child object that contains the reference to the parent object */
        fieldName: string;
        /** The names of the JunctionIdList fields associated with an object */
        junctionIdListNames: string[];
        /** A collection of object names that the polymorphic keys in the junctionIdListNames property can reference */
        junctionReferenceTo: string[];
        /** The name of the relationship */
        relationshipName: string;
    }

    /**
     * Information about record type
     */
    class RecordTypeInfo {
        /** Indicates whether this record type is available to the context user when creating a new record */
        available: boolean;
        /** Indicates whether this is the default record type mapping for the associated object */
        defaultRecordTypeMapping: boolean;
        /** Indicates whether this is the master record type */
        master: boolean;
        /** The record type's API name */
        name: string;
        /** The ID of the record type */
        recordTypeId: string;
    }

    /**
     * Creates a record.
     * @param {RecordInput} recordInput object used to create a record
     * @returns {Promise} that resolves with the created record
     */
    export function createRecord(recordInput: RecordInput): Promise<Record>;

    /**
     * Updates a record.
     * @param {RecordInput} recordInput object used to update a record
     * @return {Promise} that resolves with the updated record
     */
    export function updateRecord(recordInput: RecordInput): Promise<Record>;

    /**
     * Creates a RecordInput object to pass in a call to createRecord(recordInput)
     * @param {Record} record the record that contains the source data
     * @param objectInfo - Optional. The ObjectInfo corresponding to the apiName on the record
     * @returns {RecordInput} with its data populated from the given record
     */
    export function createRecordInputFromRecord(record: Record, objectInfo?: any): RecordInput;

    /**
     * Creates a RecordInput object with a list of fields that has been filtered by edited fields.
     * Only contains fields that have been edited from their original values.
     * @param {RecordInput} recordInput object to filter
     * @param {Record} originalRecord object that contains the original field values
     * @return {RecordInput} with a list of fields that have been edited from their original values
     */
    export function createRecordInputFilteredByEditedFields(recordInput: RecordInput, originalRecord: Record): RecordInput;
}
