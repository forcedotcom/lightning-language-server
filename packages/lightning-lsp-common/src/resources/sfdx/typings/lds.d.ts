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
     * Use this wire adapter to get the records and metadata for a list view.
     *
     * https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_get_list_ui
     *
     * @param objectApiName API name of the list view's object (must be specified along with listViewApiName).
     * @param listViewApiName API name of the list view (must be specified with objectApiName).
     * @param listViewId ID of the list view (may be specified without objectApiName or listViewApiName).
     * @param pageToken A token that represents the page offset. To indicate where the page starts, use this value with the pageSize parameter.
     *                The maximum offset is 2000 and the default is 0.
     * @param pageSize The number of list records viewed at one time. The default value is 50. Value can be 1–2000.
     * @param sortBy The API name of the field the list view is sorted by. If the name is preceded with `-`, the sort order is descending.
     *                For example, Name sorts by name in ascending order. `-CreatedDate` sorts by created date in descending order.
     *                Accepts only one value per request.
     * @param fields Additional fields queried for the records returned. These fields don’t create visible columns.
     *                If the field is not available to the user, an error occurs.
     * @param optionalFields Additional fields queried for the records returned. These fields don’t create visible columns.
     *                       If the field is not available to the user, no error occurs and the field isn’t included in the records.
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
     * @param fieldApiName The picklist field's object-qualified API name.
     * @param recordTypeId The record type ID. Pass '012000000000000AAA' for the master record type.
     */
    export function getPicklistValues(fieldApiName: string | FieldId, recordTypeId: string): void;

    /**
     * Wire adapter for values for all picklist fields of a record type.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_picklist_values_collection.htm
     *
     * @param objectApiName API name of the object.
     * @param recordTypeId Record type ID. Pass '012000000000000AAA' for the master record type.
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

    /**
     * Contains both the raw and displayable field values for a field in a Record.
     *
     * Keys:
     *    (none)
     */
    export interface FieldValueRepresentation {
        displayValue: string | null;
        value: RecordRepresentation | boolean | number | string | null;
    }
    export type FieldValueRepresentationValue = FieldValueRepresentation['value'];

    /**
     * Record Collection Representation.
     *
     * Keys:
     *    (none)
     */
    export interface RecordCollectionRepresentation {
        count: number;
        currentPageToken: string | null;
        currentPageUrl: string;
        nextPageToken: string | null;
        nextPageUrl: string | null;
        previousPageToken: string | null;
        previousPageUrl: string | null;
        records: Array<RecordRepresentation>;
    }

    /**
     * Record type.
     *
     * Keys:
     *    (none)
     */
    export interface RecordTypeInfoRepresentation {
        available: boolean;
        defaultRecordTypeMapping: boolean;
        master: boolean;
        name: string;
        recordTypeId: string;
    }

    /**
     * Record.
     *
     * Keys:
     *    recordId (string): id
     */
    export interface RecordRepresentation {
        apiName: string;
        childRelationships: {
            [key: string]: RecordCollectionRepresentation;
        };
        eTag: string;
        fields: {
            [key: string]: FieldValueRepresentation;
        };
        id: string;
        lastModifiedById: string | null;
        lastModifiedDate: string | null;
        recordTypeId: string | null;
        recordTypeInfo: RecordTypeInfoRepresentation | null;
        systemModstamp: string | null;
        weakEtag: number;
    }

    /**
     * Description of a record input.
     *
     * Keys:
     *    (none)
     */
    export interface RecordInputRepresentation {
        allowSaveOnDuplicate?: boolean;
        apiName?: string;
        fields: {
            [key: string]: string | number | null | boolean;
        };
    }

    export interface ClientOptions {
        ifUnmodifiedSince?: string;
    }

    /**
     * Child Relationship.
     *
     * Keys:
     *    (none)
     */
    export interface ChildRelationshipRepresentation {
        childObjectApiName: string;
        fieldName: string;
        junctionIdListNames: Array<string>;
        junctionReferenceTo: Array<string>;
        relationshipName: string;
    }

    /**
     * Information about a reference field's referenced types and the name field names of those types.
     *
     * Keys:
     *    (none)
     */
    export interface ReferenceToInfoRepresentation {
        apiName: string;
        nameFields: Array<string>;
    }

    /**
     * Filtered lookup info.
     *
     * Keys:
     *    (none)
     */
    export interface FilteredLookupInfoRepresentation {
        controllingFields: Array<string>;
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

    /**
     * Field metadata.
     *
     * Keys:
     *    (none)
     */
    export interface FieldRepresentation {
        apiName: string;
        calculated: boolean;
        compound: boolean;
        compoundComponentName: string | null;
        compoundFieldName: string | null;
        controllerName: string | null;
        controllingFields: Array<string>;
        createable: boolean;
        custom: boolean;
        dataType: string;
        extraTypeInfo: string | null;
        filterable: boolean;
        filteredLookupInfo: FilteredLookupInfoRepresentation | null;
        highScaleNumber: boolean;
        htmlFormatted: boolean;
        inlineHelpText: string | null;
        label: string;
        length: number;
        nameField: boolean;
        polymorphicForeignKey: boolean;
        precision: number;
        reference: boolean;
        referenceTargetField: string | null;
        referenceToInfos: Array<ReferenceToInfoRepresentation>;
        relationshipName: string | null;
        required: boolean;
        scale: number;
        searchPrefilterable: boolean;
        sortable: boolean;
        unique: boolean;
        updateable: boolean;
    }

    /**
     * Theme info.
     *
     * Keys:
     *    (none)
     */
    export interface ThemeInfoRepresentation {
        color: string;
        iconUrl: string | null;
    }

    /**
     * Object metadata.
     *
     * Keys:
     *    apiName (string): apiName
     */
    export interface ObjectInfoRepresentation {
        apiName: string;
        associateEntityType: string | null;
        associateParentEntity: string | null;
        childRelationships: Array<ChildRelationshipRepresentation>;
        createable: boolean;
        custom: boolean;
        defaultRecordTypeId: string | null;
        deletable: boolean;
        dependentFields: {
            [key: string]: {};
        };
        eTag: string;
        feedEnabled: boolean;
        fields: {
            [key: string]: FieldRepresentation;
        };
        keyPrefix: string | null;
        label: string;
        labelPlural: string;
        layoutable: boolean;
        mruEnabled: boolean;
        nameFields: Array<string>;
        queryable: boolean;
        recordTypeInfos: {
            [key: string]: RecordTypeInfoRepresentation;
        };
        searchable: boolean;
        themeInfo: ThemeInfoRepresentation | null;
        updateable: boolean;
    }

    /**
     * Wire adapter for a record.
     *
     * https://developer.salesforce.com/docs/atlas.en-us.uiapi.meta/uiapi/ui_api_resources_record_get.htm
     *
     * @param recordId ID of the record to retrieve.
     * @param fields Object-qualified field API names to retrieve. If a field isn’t accessible to the context user, it causes an error.
     *               If specified, don't specify layoutTypes.
     * @param layoutTypes Layouts defining the fields to retrieve. If specified, don't specify fields.
     * @param modes Layout modes defining the fields to retrieve.
     * @param optionalFields Object-qualified field API names to retrieve. If an optional field isn’t accessible to the context user,
     *                       it isn’t included in the response, but it doesn’t cause an error.
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
     * @param optionalFields Object-qualified field API names to retrieve. If an optional field isn’t accessible to the context user,
     *                       it isn’t included in the response, but it doesn’t cause an error.
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
     * @param recordIds ID of the records to retrieve.
     * @param layoutTypes Layouts defining the fields to retrieve.
     * @param modes Layout modes defining the fields to retrieve.
     * @param optionalFields Object-qualified field API names to retrieve. If an optional field isn’t accessible to the context user,
     *                       it isn’t included in the response, but it doesn’t cause an error.
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
     * @returns A promise that will resolve with the patched record.
     */
    export function updateRecord(recordInput: RecordInputRepresentation, clientOptions?: ClientOptions): Promise<RecordRepresentation>;

    /**
     * Creates a new record using the properties in recordInput.
     * @param recordInput The RecordInput object to use to create the record.
     * @returns A promise that will resolve with the newly created record.
     */
    export function createRecord(recordInput: RecordInputRepresentation): Promise<RecordRepresentation>;

    /**
     * Deletes a record with the specified recordId.
     * @param recordId ID of the record to delete.
     * @returns A promise that will resolve to undefined.
     */
    export function deleteRecord(recordId: string): Promise<undefined>;

    /**
     * Returns an object with its data populated from the given record. All fields with values that aren't nested records will be assigned.
     * This object can be used to create a record with createRecord().
     * @param record The record that contains the source data.
     * @param objectInfo The ObjectInfo corresponding to the apiName on the record. If provided, only fields that are createable=true
     *        (excluding Id) are assigned to the object return value.
     * @returns RecordInput
     */
    export function generateRecordInputForCreate(record: RecordRepresentation, objectInfo?: ObjectInfoRepresentation): RecordInputRepresentation;

    /**
     * Returns an object with its data populated from the given record. All fields with values that aren't nested records will be assigned.
     * This object can be used to update a record.
     * @param record The record that contains the source data.
     * @param objectInfo The ObjectInfo corresponding to the apiName on the record.
     *        If provided, only fields that are updateable=true (excluding Id) are assigned to the object return value.
     * @returns RecordInput.
     */
    export function generateRecordInputForUpdate(record: RecordRepresentation, objectInfo?: ObjectInfoRepresentation): RecordInputRepresentation;

    /**
     * Returns a new RecordInput containing a list of fields that have been edited from their original values. (Also contains the Id
     * field, which is always copied over.)
     * @param recordInput The RecordInput object to filter.
     * @param originalRecord The Record object that contains the original field values.
     * @returns RecordInput.
     */
    export function createRecordInputFilteredByEditedFields(
        recordInput: RecordInputRepresentation,
        originalRecord: RecordRepresentation,
    ): RecordInputRepresentation;

    /**
     * Gets a field's value from a record.
     * @param record The record.
     * @param field Object-qualified API name of the field to return.
     * @returns The field's value (which may be a record in the case of spanning fields), or undefined if the field isn't found.
     */
    export function getFieldValue(record: RecordRepresentation, field: FieldId | string): FieldValueRepresentationValue | undefined;

    /**
     * Gets a field's display value from a record.
     * @param record The record.
     * @param field Object-qualified API name of the field to return.
     * @returns The field's display value, or undefined if the field isn't found.
     */
    export function getFieldDisplayValue(record: RecordRepresentation, field: FieldId | string): FieldValueRepresentationValue | undefined;
}
