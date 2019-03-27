{
"aura:clientLibrary": {
    "type": "system",
    "description": "The <aura:clientLibrary> tag enables you to specify JavaScript or CSS libraries that you want to use. Use the tag in a .cmp or .app resource. Here is some example markup for including client libraries in a component.",
    "url": "http://aura-oss-dev.herokuapp.com/en-us/main/aura-oss/ref_tag_clientlibrary.htm",
    "attributes": [
        {
            "type": "String",
            "description": "If set to true, the library is added to resources.js or resources.css. This option is only available for resources that are available on the local server, for example under the aura-resources folder. Combining libraries into one file can improve performance by reducing the number of requests, instead of a separate request for each library.",
            "name": "combine",
            "required": "false",
            "access": "global"
        },
        {
            "type": "String",
            "description": "A comma-separated list of modes that use the client library. If no value is set, the library is available for all modes.",
            "name": "modes",
            "required": "false",
            "access": "global"
        },
        {
            "type": "String",
            "description": "The name of a ClientLibraryResolver that provides the URL. The name attribute is useful if the location or URL of the library needs to be dynamically generated. The name attribute is required if the url attribute is not specified; otherwise, it’s ignored. See <a href='http://aura-oss-dev.herokuapp.com/en-us/main/aura-oss/ref_tag_clientlibrary.htm#add_resolver_title'>Add a Client Library Resolver</a>",
            "required": "true",
            "name": "name",
            "access": "global"
        },
        {
            "type": "String",
            "description": "The type of library. Values are CSS, or JS for JavaScript.",
            "name": "type",
            "required": "false",
            "access": "global"
        },
        {
            "type": "String",
            "description": "The external URL or path to the file on the server for the library. Examples are: https://jquery.org/latest/jquery.js || /absolute/path/to/file.js || relative/path/to/file.css",
            "name": "url",
            "required": "false",
            "access": "global"
        },
        {
            "type": "String",
            "description": "The description of this library",
            "name": "description",
            "required": "false",
            "access": "global"
        }
    ],
    "namespace": "aura"
    },
   "aura:import": {
        "type": "system",
        "description": "Import an aura:library to be used within this component.",
        "url": "http://aura-oss-dev.herokuapp.com/en-us/main/aura-oss/components_overview.htm",
        "attributes": [
        {
            "type": "String",
            "description": "The description of this import",
            "name": "description",
            "required": "false",
            "access": "global"
        },
        {
            "type": "String",
            "description": "The library name to import. Example: library='namespace:MyLib'",
            "required": "true",
            "name": "library",
            "access": "global"
        },
        {
            "type": "String",
            "description": "The property name this library will be referenced by in your component. For example: property='myLib'. The library can now be accessed at 'helper.myLib'.",
            "required": "true",
            "name": "property",
            "access": "global"
        }
        ],
        "namespace": "aura"
    },
    "aura:library": {
       "type": "system",
       "description": "A collection of javascript functions that can be reused accross components.",
       "url": "http://aura-oss-dev.herokuapp.com/en-us/main/aura-oss/components_overview.htm",
       "attributes": [
          {
             "type": "String",
             "description": "The description of this library",
             "name": "description",
             "required": "false",
             "access": "global"
          },
          {
             "type": "String",
             "description": "The support level for the library. Valid options are PROTO, DEPRECATED, BETA, or GA.",
             "name": "support",
             "required": "false",
             "access": "global"
          }
       ],
       "namespace": "aura"
    },
    "aura:theme": {
       "type": "system",
       "description": "",
       "url": "http://aura-oss-dev.herokuapp.com/en-us/main/aura-oss/components_overview.htm",
       "attributes": [
          {
             "type": "String",
             "description": "",
             "name": "access",
             "required": "false",
             "access": "global"
          },
          {
             "type": "String",
             "description": "",
             "name": "description",
             "required": "false",
             "access": "global"
          },
          {
             "type": "Component",
             "name": "extends",
             "required": "false",
             "access": "global"
          },
          {
             "type": "String",
             "description": "",
             "name": "mapProvider",
             "required": "false",
             "access": "global"
          },
          {
             "type": "String",
             "description": "",
             "name": "provider",
             "required": "false",
             "access": "global"
          },
          {
             "type": "String",
             "description": "",
             "name": "support",
             "required": "false",
             "access": "global"
          }
       ],
       "namespace": "aura"
    },
}