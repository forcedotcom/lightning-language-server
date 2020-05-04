// tslint:disable-next-line:quotemark
export const QUICKFIX_LIGHTNING_TYPO = 'is not a valid namespace, sure you didn\'t mean "<lightning-"?';
export const QUICKFIX_AMBIGUOUS_ATTR = 'LWC1034'; // Ambiguous attribute value
export const QUICKFIX_DISALLOWED_COMP_PROP = 'LWC1038'; // Template expression doesn't allow computed property access
export const QUICKFIX_ITERATOR_EXPRESSION = 'LWC1039'; // iterator:it directive is expected to be an expression
export const QUICKFIX_FOREACH_EXPRESSION = 'LWC1045'; // for:each directive is expected to be an expression
export const QUICKFIX_FORINDEX_STRING = 'LWC1046'; // for:index directive is expected to be a string
export const QUICKFIX_FORITEM_STRING = 'LWC1047'; // for:item directive is expected to be a string
export const QUICKFIX_IF_EXPRESSION = 'LWC1054'; // If directive should be an expression
export const QUICKFIX_DISALLOWED_EXPRESSION = 'LWC1060'; // Template expression doesn't allow UnaryExpression / NumericLiteral / CallExpression
export const QUICKFIX_KEY_EXPRESSION = 'LWC1064'; // Key attribute value should be an expression
export const QUICKFIX_INSERT_KEY = 'LWC1071'; // Missing key for element <xyz> inside of iterator.
export const QUICKFIX_UNEXPECTED_IF = 'LWC1084'; // Unexpected if modifier
export const QUICKFIX_INVALID_DECORATOR = 'LWC1100'; // Invalid decorator usage

export const MSG_QUICKFIX_LIGHTNING_TYPO = 'Replace tag with <lightning-';
export const MSG_QUICKFIX_CONVERT_TO_EXPRESSION = 'Convert into expression';
export const MSG_QUICKFIX_CONVERT_TO_STRING = 'Convert into string';
export const MSG_QUICKFIX_IMPORT_DECORATOR = 'Import @ decorator';
export const MSG_QUICKFIX_IF_FALSE = 'Convert to if:false';
export const MSG_QUICKFIX_IF_TRUE = 'Convert to if:true';
export const MSG_QUICKFIX_AMBIGUITY = 'Resolve ambiguity';
export const MSG_QUICKFIX_FIX_INVALID_EXPRESSION = 'Fix expression';
export const MSG_QUICKFIX_INSERT_KEY = 'Insert key attribute';
