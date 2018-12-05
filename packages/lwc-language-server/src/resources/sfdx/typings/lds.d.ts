declare module 'lightning/uiListApi' {
    /**
     * Identifier for an object.
     */
    export interface ObjectId {
        /** The object's API name. */
        objectApiName: string;
    }

    /**
     * Identifier for an object's field.
     */
    export interface FieldId {
        /** The field's API name. */
        fieldApiName: string;
        /** The object's API name. */
        objectApiName: string;
    }

    /**
     * Wire adapter for list view records and metadata.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_list_views_records_md.htm
     *
     * @param objectApiName The API name of the List view's object (must be specified along with listViewApiName).
     * @param listViewApiName The API name of the list view (must be specified with objectApiName).
     * @param listViewId Id of the list view (may be specified without objectApiName or listViewApiName).
     * @param pageToken Page id of records to retrieve.
     * @param pageSize Number of records to retrieve at once. The default value is 50. Value can be 1–2000.
     * @param sortBy A qualified field API name on which to sort.
     * @param fields An array of qualified field API names of fields to include. These fields don’t create visible columns.
     *               If the field is not available to the user, an error occurs.
     * @param optionalFields An array of qualified field API names of optional fields to include. These fields don’t create visible columns.
     *                       If the field is not available to the user, no error occurs and the field isn’t included in the records.
     * @param q Query string to filter list views (only for list of lists).
     * @returns {Observable} See description.
     */
    export function getListUi(
        objectApiName?: string | ObjectId,
        listViewApiName?: string | symbol,
        listViewId?: string,
        pageToken?: string,
        pageSize?: number,
        sortBy?: string | FieldId,
        fields?: Array<string | FieldId>,
        optionalFields?: Array<string | FieldId>,
        q?: string,
    ): void;
}

declare module 'lightning/uiObjectInfoApi' {
    /**
     * Identifier for an object.
     */
    export interface ObjectId {
        /** The object's API name. */
        objectApiName: string;
    }

    /**
     * Identifier for an object's field.
     */
    export interface FieldId {
        /** The field's API name. */
        fieldApiName: string;
        /** The object's API name. */
        objectApiName: string;
    }

    /**
     * Wire adapter for object metadata.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_object_info.htm
     *
     * @param objectApiName The API name of the object to retrieve.
     */
    export function getObjectInfo(objectApiName: string | ObjectId): void;

    /**
     * Wire adapter for values for a picklist field.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_picklist_values.htm
     *
     * @param fieldApiName The picklist field's qualified API name.
     * @param recordTypeId The record type id. Pass '012000000000000AAA' for the master record type.
     */
    export function getPicklistValues(fieldApiName: string | FieldId, recordTypeId: string): void;

    /**
     * Wire adapter for values for all picklist fields of a record type.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_picklist_values_collection.htm
     *
     * @param objectApiName API name of the object.
     * @param recordTypeId Record type id. Pass '012000000000000AAA' for the master record type.
     */
    export function getPicklistValuesByRecordType(objectApiName: string, recordTypeId: string): void;
}

/**
 * JavaScript API to Create and Update Records.
 */
declare module 'lightning/uiRecordApi' {
    /**
     * Identifier for an object.
     */
    export interface ObjectId {
        /** The object's API name. */
        objectApiName: string;
    }

    /**
     * Identifier for an object's field.
     */
    export interface FieldId {
        /** The field's API name. */
        fieldApiName: string;
        /** The object's API name. */
        objectApiName: string;
    }

    export type FieldValueRepresentationValue = null | boolean | number | string | RecordRepresentation;
    export interface FieldValueRepresentation {
        displayValue: string | null;
        value: FieldValueRepresentationValue;
    }

    export interface RecordCollectionRepresentation {
        eTag?: string;
        count: number;
        currentPageToken: string;
        currentPageUrl: string;
        nextPageToken: string;
        nextPageUrl: string;
        previousPageToken: string;
        previousPageUrl: string;
        records: RecordRepresentation[];
    }

    export interface RecordTypeInfoRepresentation {
        available: boolean;
        defaultRecordTypeMapping: boolean;
        master: boolean;
        name: string;
        recordTypeId: string;
    }

    export interface RecordRepresentation {
        apiName: string;
        childRelationships?: { [key: string]: RecordCollectionRepresentation };
        fields: { [key: string]: FieldValueRepresentation };
        id: string;
        lastModifiedById: string;
        lastModifiedDate: string;
        recordTypeInfo?: RecordTypeInfoRepresentation;
        systemModstamp: string;
    }

    export interface RecordInput {
        apiName?: string;
        fields: { [key: string]: string | null };
        allowSaveOnDuplicate?: boolean;
        recordTypeInfo?: RecordTypeInfoRepresentation;
        LastModifiedDate?: string;
    }

    export interface ClientOptions {
        eTagToCheck?: string;
        ifUnmodifiedSince?: string;
    }

    export interface ChildRelationshipRepresentation {
        childObjectApiName: string;
        fieldName: string;
        junctionIdListNames: string[];
        junctionReferenceTo: string[];
        relationshipName: string;
    }

    export interface ReferenceToInfoRepresentation {
        apiName: string;
        nameFields: string[];
    }

    export interface FilteredLookupInfoRepresentation {
        controllingFields: string[];
        dependent: boolean;
        optionalFilter: boolean;
    }

    export const enum ExtraTypeInfo {
        ExternalLookup = 'ExternalLookup',
        ImageUrl = 'ImageUrl',
        IndirectLookup = 'IndirectLookup',
        PersonName = 'PersonName',
        PlainTextArea = 'PlainTextArea',
        RichTextArea = 'RichTextArea',
        SwitchablePersonName = 'SwitchablePersonName',
    }

    export const enum RecordFieldDataType {
        Address = 'Address',
        Base64 = 'Base64',
        Boolean = 'Boolean',
        ComboBox = 'ComboBox',
        ComplexValue = 'ComplexValue',
        Currency = 'Currency',
        Date = 'Date',
        DateTime = 'DateTime',
        Double = 'Double',
        Email = 'Email',
        EncryptedString = 'EncryptedString',
        Int = 'Int',
        Location = 'Location',
        MultiPicklist = 'MultiPicklist',
        Percent = 'Percent',
        Phone = 'Phone',
        Picklist = 'Picklist',
        Reference = 'Reference',
        String = 'String',
        TextArea = 'TextArea',
        Time = 'Time',
        Url = 'Url',
    }

    export interface FieldRepresentation {
        apiName: string;
        calculated: boolean;
        compound: boolean;
        compoundComponentName: string;
        compoundFieldName: string;
        controllerName: string;
        controllingFields: string[];
        createable: boolean;
        custom: boolean;
        dataType: RecordFieldDataType;
        extraTypeInfo: ExtraTypeInfo;
        filterable: boolean;
        filteredLookupInfo: FilteredLookupInfoRepresentation;
        highScaleNumber: boolean;
        htmlFormatted: boolean;
        inlineHelpText: string;
        label: string;
        length: number;
        nameField: boolean;
        polymorphicForeignKey: boolean;
        precision: number;
        reference: boolean;
        referenceTargetField: string;
        referenceToInfos: ReferenceToInfoRepresentation[];
        relationshipName: string;
        required: boolean;
        scale: number;
        searchPrefilterable: boolean;
        sortable: boolean;
        unique: boolean;
        updateable: boolean;
    }

    interface ThemeInfoRepresentation {
        color: string;
        iconUrl: string;
    }

    export interface ObjectInfoRepresentation {
        apiName: string;
        childRelationships: ChildRelationshipRepresentation[];
        createable: boolean;
        custom: boolean;
        defaultRecordTypeId: string;
        deletable: boolean;
        deleteable: boolean;
        dependentFields: { [key: string]: any };
        eTag: string;
        feedEnabled: boolean;
        fields: { [key: string]: FieldRepresentation };
        keyPrefix: string;
        label: string;
        labelPlural: string;
        layoutable: boolean;
        mruEnabled: boolean;
        nameFields: string[];
        queryable: boolean;
        recordTypeInfos: { [key: string]: RecordTypeInfoRepresentation };
        searchable: boolean;
        themeInfo: ThemeInfoRepresentation;
        updateable: boolean;
    }

    /**
     * Wire adapter for a record.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_record_get.htm
     *
     * @param recordId Id of the record to retrieve.
     * @param fields Qualified field API names to retrieve. If any are inaccessible then an error is emitted. If specified must not specify layoutTypes.
     * @param layoutTypes List of layoutTypes identifying the layouts from which to grab the field list. If specified must not specify fields.
     * @param modes List of modes identifying the layouts from which to grab the field list.
     * @param optionalFields Qualified field API names to retrieve. If any are inaccessible then they are silently omitted.
     * @returns An observable of the record.
     */
    export function getRecord(
        recordId: string,
        fields?: Array<string | FieldId>,
        layoutTypes?: string[],
        modes?: string[],
        optionalFields?: Array<string | FieldId>,
    ): void;

    /**
     * Wire adapter for default field values to create a record.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_record_defaults_create.htm#ui_api_resources_record_defaults_create
     *
     * @param objectApiName API name of the object.
     * @param formFactor Form factor. Possible values are 'Small', 'Medium', 'Large'. Large is default.
     * @param recordTypeId Record type id.
     * @param optionalFields Qualified field API names. If any are inaccessible then they are silently omitted.
     */
    export function getRecordCreateDefaults(
        objectApiName: string | ObjectId,
        formFactor?: string,
        recordTypeId?: string,
        optionalFields?: Array<string | FieldId>,
    ): void;

    /**
     * Wire adapter for record data, object metadata and layout metadata
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_record_ui.htm
     *
     * @param recordIds Id of the records to retrieve.
     * @param layoutTypes Layouts defining the fields to retrieve.
     * @param modes Layout modes defining the fields to retrieve.
     * @param optionalFields Qualified field API names to retrieve. If any are inaccessible then they are silently omitted.
     */
    export function getRecordUi(
        recordIds: string | string[],
        layoutTypes: string | string[],
        modes: string | string[],
        optionalFields: Array<string | FieldId>,
    ): void;

    /**
     * Updates a record using the properties in recordInput. recordInput.fields.Id must be specified.
     * @param recordInput The record input representation to use to update the record.
     * @param clientOptions Controls the update behavior. Specify ifUnmodifiedSince to fail the save if the record has changed since the provided value.
     * @returns A promise that will resolve with the patched record. The record will contain data for the list of fields as defined by the
     *          applicable layout for the record as well as any specified additionalFieldsToReturn.
     */
    export function updateRecord(recordInput: RecordInput, clientOptions?: ClientOptions): Promise<RecordRepresentation>;

    /**
     * Creates a new record using the properties in recordInput.
     * @param recordInput The RecordInput object to use to create the record.
     * @returns A promise that will resolve with the newly created record.
     *          The record will contain data for the list of fields as defined by the applicable layout
     *          for the record.
     */
    export function createRecord(recordInput: RecordInput): Promise<RecordRepresentation>;

    /**
     * Deletes a record given the recordId.
     * @param recordId The 18 char record ID for the record to be retrieved.
     * @returns A promise that will resolve to undefined.
     */
    export function deleteRecord(recordId: string): Promise<undefined>;

    /**
     * Returns an object with its data populated from the given record. All fields with values that aren't nested records will be assigned.
     * This object can be used to create a record with createRecord().
     * @param record The record that contains the source data.
     * @param objectInfo The ObjectInfo corresponding to the apiName on the record. If provided, only fields that are createable=true
     *        (excluding Id) will be assigned to the object return value.
     * @returns RecordInput
     */
    export function generateRecordInputForCreate(record: RecordRepresentation, objectInfo?: ObjectInfoRepresentation): RecordInput;

    /**
     * Returns an object with its data populated from the given record. All fields with values that aren't nested records will be assigned.
     * This object can be used to update a record.
     * @param record The record that contains the source data.
     * @param objectInfo The ObjectInfo corresponding to the apiName on the record.
     *        If provided, only fields that are updateable=true (excluding Id) will be assigned to the object return value.
     * @returns RecordInput.
     */
    export function generateRecordInputForUpdate(record: RecordRepresentation, objectInfo?: ObjectInfoRepresentation): RecordInput;

    /**
     * Returns a new RecordInput that has a list of fields that has been filtered by edited fields. Only contains fields that have been
     * edited from their original values (excluding Id which is always copied over.)
     * @param recordInput The RecordInput object to filter.
     * @param originalRecord The Record object that contains the original field values.
     * @returns RecordInput.
     */
    export function createRecordInputFilteredByEditedFields(recordInput: RecordInput, originalRecord: RecordRepresentation): RecordInput;

    /**
     * Gets a field's value from a record.
     * @param record The record.
     * @param field The qualified API name of the field to return.
     * @returns The field's value (which may be a record in the case of spanning fields), or undefined if the field isn't found.
     */
    export function getFieldValue(record: RecordRepresentation, field: FieldId | string): FieldValueRepresentationValue | undefined;

    /**
     * Gets a field's display value from a record.
     * @param record The record.
     * @param field The qualified API name of the field to return.
     * @returns The field's display value, or undefined if the field isn't found.
     */
    export function getFieldDisplayValue(record: RecordRepresentation, field: FieldId | string): FieldValueRepresentationValue | undefined;
}
