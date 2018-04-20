declare module 'lightning-ui-api-list-ui' {
    /**
     * Wire adapter for list view records and metadata
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_list_views_records_md.htm
     *
     * @param {String} objectApiName TBD
     * @param {String} listViewApiName TBD
     * @param {String} listViewId TBD
     * @param {String} pageToken TBD
     * @param {Integer} pageSize TBD
     * @param {String} sortBy TBD
     * @param {Array} fields An array of fieldApiNames of optional fields to include.
     * @param {Array} optionalFields An array of fieldApiNames of optional fields to include.
     * @param {String} labelQuery Query string to filter list views (only for list of lists)
     */
    export function getListUi(
        objectApiName: string,
        listViewApiName: string,
        listViewId: string,
        pageToken: string,
        pageSize: number,
        sortBy: string,
        fields?: string[],
        optionalFields?: string[],
        labelQuery?: string,
    ): void;
}

declare module 'lightning-ui-api-lookups' {
    /**
     * Wire adapter for lookup field suggestions for a specified object
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_lookup_object_get.htm
     *
     * @param {String} objectApiName: API name of source entity.
     * @param {String} fieldApiName: API name of field on source entity.
     * @param {String} targetApiName: API name of target entity.
     * @param {Object} requestParams: Request params to filter data.
     */
    export function getLookupRecords(objectApiName: string, fieldApiName: string, targetApiName: string, requestParams?: {}): void;
}

declare module 'lightning-ui-api-object-info' {
    /**
     * Wire adapter for object metadata
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_object_info.htm
     *
     * @param {String} objectApiName: The api name for the object to be retrieved.
     * @returns {Observable<Object>} - An observable for the object info specified by the given objectApiName.
     */
    export function getObjectInfo(objectApiName: string): void;

    /**
     * Wire adapter for values for a picklist field
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_picklist_values.htm
     *
     * @param {String} objectApiName: The object api name.
     * @param {String} recordTypeId: The record type id. Pass '012000000000000AAA' for the master record type.
     * @param {String} fieldApiName: The field api name.
     * @returns {Observable<object>} - An observable for the picklist values specified by the given parameters.
     */
    export function getPicklistValues(objectApiName: string, recordTypeId: string, fieldApiName: string): void;

    /**
     * Wire adapter for values for all picklist fields of a record type
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_picklist_values_collection.htm
     *
     * @param {String} objectApiName: The object api name.
     * @param {String} recordTypeId: The record type id. Pass '012000000000000AAA' for the master record type.
     * @returns {Observable<object>} - An observable for the picklist values specified by the given parameters.
     */
    export function getPicklistValuesForRecordType(objectApiName: string, recordTypeId: string): void;
}

/**
 * JavaScript API to Create and Update Records
 */
declare module 'lightning-ui-api-record' {
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
     * Creates a new record using the properties defined in the given recordInput.
     * @param {RecordInput} recordInput: The RecordInput object to use to create the record.
     * @param {Boolean} allowSaveOnDuplicate: Should save be allowed overriding duplicate check. Default false.
     * @returns {Promise<Record>} - A promise that will resolve with the newly created record.
     *          The record will contain data for the list of fields as defined by the applicable layout
     *          for the record
     */
    export function createRecord(recordInput: RecordInput, allowSaveOnDuplicate?: boolean): Promise<Record>;

    /**
     * Updates a given record with updates described in the given recordInput object. Must have the recordInput.fields.Id property set to the record id
     * of the record to update.
     * @param {RecordInput} recordInput: The record input representation to use to update the record.
     * @param {Boolean} allowSaveOnDuplicate: Should save be allowed overriding duplicate check. Default false.
     * @param {Object} clientOptions: Should take ifUnmodifiedSince to check for conflicts for update
     * @returns {Promise<Record>} - A promise that will resolve with the patched record. The record will contain data for the list of fields as defined by the
     *          applicable layout for the record.
     */
    export function updateRecord(recordInput: RecordInput, allowSaveOnDuplicate?: boolean, clientOptions?: object): Promise<Record>;

    /**
     * Returns an object with its data populated from the given record. All fields with values that aren't nested records will be assigned.
     * @param {Record} record: The record that contains the source data.
     * @param {Object} objectInfo: Optional. The ObjectInfo corresponding to the apiName on the record.
     *      If provided, only fields that are updatable=true (excluding Id) will be assigned to the recordInput return value.
     * @returns {RecordInput} - See description.
     */
    export function createRecordInputFromRecord(record: Record, objectInfo?: object): RecordInput;

    /**
     * Returns a new object that has a list of fields that has been filtered by edited fields. Only contains fields that have been
     * edited from their original values (excluding Id which is always copied over.)
     * @param {RecordInput} recordInput: The RecordInput object to filter.
     * @param {Record} originalRecord: The Record object that contains the original field values.
     * @returns {RecordInput} - See description.
     */
    export function createRecordInputFilteredByEditedFields(recordInput: RecordInput, originalRecord: Record): RecordInput;

    /**
     * Value object which represents a new or updated record to be saved on the server.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_requests_record_input.htm
     *
     * @returns {RecordInput} - See description
     */
    export function getRecordInput(): RecordInput;

    /**
     * Wire adapter for a record specified by the given recordId that has the given fields. Will retrieve it from the cache if available, or
     * get a fresh value from the server.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_record_get.htm
     *
     * @param {String} recordId: The 18 char record ID for the record to be retrieved.
     * @param {Array} fields: The field API names for the record to be retrieved.
     * @param {Array} optionalFields: The optional field API names for the record to be retrieved.
     *        Inaccessible fields will be silently omitted.
     */
    export function getRecord(recordId: string, fields: string[], optionalFields?: string[]): void;

    /**
     * Wire adapter for default field values to create a record
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_record_defaults_create.htm#ui_api_resources_record_defaults_create
     *
     * @param {String} apiName: The apiName of the record create defaults to retrieve.
     * @param {String} formFactor: Optional. The form factor of the record create defaults to retrieve. Possible values are 'Full', 'Compact'.
     * @param {String} recordTypeId: Optional. The record type id of the record create defaults to retrieve.
     * @param optionalFields: Optional. An array of qualified fieldApiNames of optional fields to include.
     */
    export function getRecordCreateDefaults(apiName: string, formFactor?: string, recordTypeId?: string, optionalFields?: string[]): void;
}

declare module 'lightning-ui-api-record-ui' {
    /**
     * Wire adapter for record data, object metadata and layout metadata
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_record_ui.htm
     *
     * @param {Array} recordIds: An array of record ids to include in the record ui.
     * @param {Array} layoutTypes: An array of layout types.
     * @param {Array} modes: An array of modes.
     * @param {Array} optionalFields: An array of fieldApiNames of optional fields to include.
     */
    export function getRecordUi(recordIds: string[], layoutTypes: string[], modes: string[], optionalFields?: string[]): void;
}
