import * as t from 'io-ts'

export namespace OpenAPI {

  /** The object provides metadata about the API. 
   * The metadata MAY be used by the clients if needed, and MAY be presented in editing or documentation generation tools for convenience.
   * This object MAY be extended with Specification Extensions.
   * */
  const Info = t.type({

    /** The title of the API. */
    title: t.string,

    /** The version of the OpenAPI document (which is distinct from the OpenAPI Specification version or the API implementation version). */
    version: t.string
  })

  interface RecursiveSchemaInterface {
    allOf?: Compiletime<'Schema'>[],
    oneOf?: Compiletime<'Schema'>[],
    anyOf?: Compiletime<'Schema'>[],
    not?: Compiletime<'Schema'>,
    items?: Compiletime<'Schema'>,
    properties?: Record<string, Compiletime<'Schema'>>,
    additionalProperties?: boolean | Compiletime<'Schema'>,
  }

  const RecursiveSchema: t.Type<RecursiveSchemaInterface> = t.recursion('RecursiveSchema', () => t.partial({

    /** [JSONSchema] This keyword's value MUST be an array.  
     * This array MUST have at least one element.
     * Elements of the array MUST be objects.  
     * Each object MUST be a valid JSON Schema.
     * An instance validates successfully against this keyword if it validates successfully against all schemas defined by this keyword's value.
     * 
     * [OpenAPI] Inline or referenced schema MUST be of a Schema Object and not a standard JSON Schema. 
     * */
    allOf: t.array(Schema),

    /** [JSONSchema] This keyword's value MUST be an array.  
     * This array MUST have at least one element.
     * Elements of the array MUST be objects.  
     * Each object MUST be a valid JSON Schema.
     * An instance validates successfully against this keyword if it validates successfully against exactly one schema defined by this keyword's value.
     * 
     * [OpenAPI] Inline or referenced schema MUST be of a Schema Object and not a standard JSON Schema. 
     * */
    oneOf: t.array(Schema),

    /** [JSONSchema] This keyword's value MUST be an array.  
     * This array MUST have at least one element.
     * Elements of the array MUST be objects.  
     * Each object MUST be a valid JSON Schema.
     * An instance validates successfully against this keyword if it validates successfully against at least one schema defined by this keyword's value.
     * 
     * [OpenAPI] Inline or referenced schema MUST be of a Schema Object and not a standard JSON Schema. 
     * */
    anyOf: t.array(Schema),

    /** [JSONSchema] This keyword's value MUST be an object.  
     * This object MUST be a valid JSON Schema.
     * An instance is valid against this keyword if it fails to validate successfully against the schema defined by this keyword.
     * 
     * [OpenAPI] Inline or referenced schema MUST be of a Schema Object and not a standard JSON Schema. 
     * */
    not: Schema,

    /** [JSONSchema] The value of "items" MUST be either a schema or array of schemas.
     * Successful validation of an array instance with regards to these two keywords is determined as follows:
     * if "items" is not present, or its value is an object, validation of the instance always succeeds, regardless of the value of "additionalItems";
     * if the value of "additionalItems" is boolean value true or an object, validation of the instance always succeeds;
     * if the value of "additionalItems" is boolean value false and the value of "items" is an array, the instance is valid if its size is less than, or equal to, the size of "items".
     * If either keyword is absent, it may be considered present with an empty schema.
     * 
     * [OpenAPI] Value MUST be an object and not an array. 
     * Inline or referenced schema MUST be of a Schema Object and not a standard JSON Schema. 
     * items MUST be present if the type is array. 
     * */
    items: Schema,

    /** [JSONSchema] The value of "properties" MUST be an object.
     * Each value of this object MUST be an object, and each object MUST be a valid JSON Schema.
     * If absent, it can be considered the same as an empty object.
     * 
     * [OpenAPI] Property definitions MUST be a Schema Object and not a standard JSON Schema (inline or referenced). 
     * */
    properties: t.record(t.string, Schema),

    /** [JSONSchema] The value of "additionalProperties" MUST be a boolean or a schema.
     * If "additionalProperties" is absent, it may be considered present with an empty schema as a value.
     * If "additionalProperties" is true, validation always succeeds.
     * If "additionalProperties" is false, validation succeeds only if the instance is an object and all properties on the instance were covered by "properties" and/or "patternProperties".
     * If "additionalProperties" is an object, validate the value as a schema to all of the properties that weren't validated by "properties" nor "patternProperties".
     * 
     * [OpenAPI] Value can be boolean or object.
     * Inline or referenced schema MUST be of a Schema Object and not a standard JSON Schema. 
     * Consistent with JSON Schema, additionalProperties defaults to true. 
     * */
    additionalProperties: t.union([t.boolean, Schema]),
  }))

  /** The Schema Object allows the definition of input and output data types. 
   * These types can be objects, but also primitives and arrays. 
   * This object is an extended subset of the JSON Schema Specification Wright Draft 00.
   * For more information about the properties, see JSON Schema Core and JSON Schema Validation. 
   * Unless stated otherwise, the property definitions follow the JSON Schema. 
   * */
  const Schema = t.intersection([
    RecursiveSchema,

    t.partial({


      // MARK: The following properties are taken directly from the JSON Schema definition and follow the same specifications:

      /** [JSONSchema] The value of both of these keywords MUST be a string.
       * Both of these keywords can be used to decorate a user interface with information about the data produced by this user interface.
       * A title will preferrably be short, whereas a description will provide explanation about the purpose of the instance described by this schema. 
       * Both of these keywords MAY be used in root schemas, and in any subschemas.
       * */
      title: t.string,

      /** [JSONSchema] The value of "multipleOf" MUST be a number, strictly greater than 0.
       * A numeric instance is only valid if division by this keyword's value results in an integer. 
       * */
      multipleOf: t.number,

      /** [JSONSchema] The value of "maximum" MUST be a number, representing an upper limit for a numeric instance.
       * If the instance is a number, then this keyword validates if "exclusiveMaximum" is true and instance is less than the provided value, or else if the instance is less than or exactly equal to the provided value. 
       * */
      maximum: t.number,

      /** [JSONSchema] The value of "exclusiveMaximum" MUST be a boolean, representing whether the limit in "maximum" is exclusive or not. 
       * An undefined value is the same as false.
       * If "exclusiveMaximum" is true, then a numeric instance SHOULD NOT be equal to the value specified in "maximum". 
       * If "exclusiveMaximum" is false (or not specified), then a numeric instance MAY be equal to the value of "maximum". 
       * */
      exclusiveMaximum: t.boolean,

      /** [JSONSchema] The value of "minimum" MUST be a number, representing a lower limit for a numeric instance.
       * If the instance is a number, then this keyword validates if "exclusiveMinimum" is true and instance is greater than the provided value, or else if the instance is greater than or exactly equal to the provided value. 
       * */
      minimum: t.number,

      /** [JSONSchema] The value of "exclusiveMinimum" MUST be a boolean, representing whether the limit in "minimum" is exclusive or not.  
       * An undefined value is the same as false.
       * If "exclusiveMinimum" is true, then a numeric instance SHOULD NOT be equal to the value specified in "minimum".  
       * If "exclusiveMinimum" is false (or not specified), then a numeric instance MAY be equal to the value of "minimum". 
       * */
      exclusiveMinimum: t.boolean,

      /** [JSONSchema] The value of this keyword MUST be a non-negative integer.
       * The value of this keyword MUST be an integer.  
       * This integer MUST be greater than, or equal to, 0.
       * A string instance is valid against this keyword if its length is less than, or equal to, the value of this keyword.
       * The length of a string instance is defined as the number of its characters as defined by RFC 7159 [RFC7159]. 
       * */
      maxLength: t.number,

      /** [JSONSchema] A string instance is valid against this keyword if its length is greater than, or equal to, the value of this keyword.
       * The length of a string instance is defined as the number of its characters as defined by RFC 7159 [RFC7159].
       * The value of this keyword MUST be an integer. 
       * This integer MUST be greater than, or equal to, 0.
       * "minLength", if absent, may be considered as being present with integer value 0. 
       * */
      minLength: t.number,

      /** [JSONSchema] The value of this keyword MUST be a string.
       * This string SHOULD be a valid regular expression, according to the ECMA 262 regular expression dialect.
       * A string instance is considered valid if the regular expression matches the instance successfully.  
       * Recall: regular expressions are not implicitly anchored.
       * 
       * [OpenAPI] This string SHOULD be a valid regular expression, according to the Ecma-262 Edition 5.1 regular expression dialect 
       * */
      pattern: t.string,

      /** [JSONSchema] The value of this keyword MUST be an integer. 
       * This integer MUST be greater than, or equal to, 0.
       * An array instance is valid against "maxItems" if its size is less than, or equal to, the value of this keyword. 
       * */
      maxItems: t.number,

      /** [JSONSchema] The value of this keyword MUST be an integer.  
       * This integer MUST be greater than, or equal to, 0.
       * An array instance is valid against "minItems" if its size is greater than, or equal to, the value of this keyword.
       * If this keyword is not present, it may be considered present with a value of 0. 
       * */
      minItems: t.number,

      /** [JSONSchema] The value of this keyword MUST be a boolean.
       * If this keyword has boolean value false, the instance validates successfully.  
       * If it has boolean value true, the instance validates successfully if all of its elements are unique.
       * If not present, this keyword may be considered present with boolean value false. */
      uniqueItems: t.boolean,

      /** [JSONSchema] The value of this keyword MUST be an integer. 
       * This integer MUST be greater than, or equal to, 0.
       * An object instance is valid against "maxProperties" if its number of properties is less than, or equal to, the value of this keyword. 
       * */
      maxProperties: t.number,

      /** [JSONSchema] The value of this keyword MUST be an integer. 
       * This integer MUST be greater than, or equal to, 0.
       * An object instance is valid against "minProperties" if its number of properties is greater than, or equal to, the value of this keyword.
       * If this keyword is not present, it may be considered present with a
       * value of 0. 
       * */
      minProperties: t.number,

      /** [JSONSchema] The value of this keyword MUST be an array.
       * This array MUST have at least one element.
       * Elements of this array MUST be strings, and MUST be unique.
       * An object instance is valid against this keyword if its property set contains all elements in this keyword's array value. 
       * */
      required: t.array(t.string),

      /** [JSONSchema] The value of this keyword MUST be an array. 
       * This array SHOULD have at least one element.
       * Elements in the array SHOULD be unique.
       * Elements in the array MAY be of any type, including null.
       * An instance validates successfully against this keyword if its value is equal to one of the elements in this keyword's array value. 
       * */
      enum: t.array(t.union([t.string, t.number, t.boolean, t.null])), // FIXME: Include arrays and objects?


      // MARK: The following properties are taken from the JSON Schema definition but their definitions were adjusted to the OpenAPI Specification.

      /** [JSONSchema] The value of this keyword MUST be either a string or an array.  
       * If it is an array, elements of the array MUST be strings and MUST be unique.
       * String values MUST be one of the seven primitive types defined by the core specification.
       * An instance matches successfully if its primitive type is one of the types defined by keyword.  
       * Recall: "number" includes "integer".
       * 
       * [OpenAPI] Value MUST be a string. 
       * Multiple types via an array are not supported. 
       * */
      type: t.union([
        t.literal('null'),
        t.literal('object'),
        t.literal('array'),
        t.literal('string'),
        t.literal('boolean'),
        t.literal('number'), 
        t.literal('integer'),
      ]),

      /** /** [JSONSchema] The value of both of these keywords MUST be a string.
       * Both of these keywords can be used to decorate a user interface with information about the data produced by this user interface.
       * A title will preferrably be short, whereas a description will provide explanation about the purpose of the instance described by this schema.
       * Both of these keywords MAY be used in root schemas, and in any subschemas.
       * 
       * [OpenAPI] CommonMark syntax MAY be used for rich text representation. 
       * */
      description: t.string,

      /** See Data Type Formats for further details. 
       * While relying on JSON Schema's defined formats, the OAS offers a few additional predefined formats. */
      format: t.string,

      /** [JSONSchema] There are no restrictions placed on the value of this keyword.
       * This keyword can be used to supply a default JSON value associated with a particular schema.  
       * It is RECOMMENDED that a default value be valid against the associated schema.
       * This keyword MAY be used in root schemas, and in any subschemas.
       * 
       * [OpenAPI] The default value represents what would be assumed by the consumer of the input as the value of the schema if one is not provided. 
       * Unlike JSON Schema, the value MUST conform to the defined type for the Schema Object defined at the same level. 
       * For example, if type is string, then default can be "foo" but cannot be 1. 
       * */
      default: t.string,


      // MARK: Additional properties defined by the JSON Schema specification that are not mentioned here are strictly unsupported.


      // MARK: Other than the JSON Schema subset fields, the following fields MAY be used for further schema documentation:

      /** A true value adds "null" to the allowed type specified by the type keyword, only if type is explicitly defined within the same Schema Object. 
       * Other Schema Object constraints retain their defined behavior, and therefore may disallow the use of null as a value. 
       * A false value leaves the specified or default type unmodified. 
       * The default value is false. 
       * */
      nullable: t.boolean,
    }),
  ])

  /** A simple object to allow referencing other components in the specification, internally and externally.
   * The Reference Object is defined by JSON Reference and follows the same structure, behavior and rules.
   * For this specification, reference resolution is accomplished as defined by the JSON Reference specification and not by the JSON Schema specification.
   * This object cannot be extended with additional properties and any properties added SHALL be ignored. 
   * */
  const Reference = t.type({

    /** The reference string. */
    $ref: t.string
  })

  /** Each Media Type Object provides schema and examples for the media type identified by its key.
   * This object MAY be extended with Specification Extensions.
   */
  const MediaType = t.partial({

    /** The schema defining the content of the request, response, or parameter. */
    schema: Reference // FIXME: Allow literal Schema objects as well (using discriminated union?)
  })

  /** Describes a single response from an API Operation, including design-time, static links to operations based on the response.
   * This object MAY be extended with Specification Extensions.
   */
  const Response = t.intersection([
    t.type({

      /** A short description of the response. 
       * CommonMark syntax MAY be used for rich text representation.
       * */
      description: t.string,
    }),
    t.partial({

      /** A map containing descriptions of potential response payloads. 
       * The key is a media type or media type range and the value describes it. 
       * For responses that match multiple keys, only the most specific key is applicable. 
       * e.g. text/plain overrides text/* 
       * */
      content: t.record(
        t.string,
        MediaType
      )
    }),
  ])

  /** A container for the expected responses of an operation. 
   * The container maps a HTTP response code to the expected response.
   * The documentation is not necessarily expected to cover all possible HTTP response codes because they may not be known in advance. 
   * However, documentation is expected to cover a successful operation response and any known errors.
   * The default MAY be used as a default response object for all HTTP codes that are not covered individually by the specification.
   * The Responses Object MUST contain at least one response code, and it SHOULD be the response for a successful operation call. 
   * This object MAY be extended with Specification Extensions.
   * */
  const Responses = t.record(

    /** Any HTTP status code can be used as the property name, but only one property per code, to describe the expected response for that HTTP status code.
     * A Reference Object can link to a response that is defined in the OpenAPI Object's components/responses section. 
     * This field MUST be enclosed in quotation marks (for example, "200") for compatibility between JSON and YAML. 
     * To define a range of response codes, this field MAY contain the uppercase wildcard character X.
     * For example, 2XX represents all response codes between [200-299]. 
     * Only the following range definitions are allowed: 1XX, 2XX, 3XX, 4XX, and 5XX. 
     * If a response is defined using an explicit code, the explicit code definition takes precedence over the range definition for that code. 
     * */
    t.number, // FIXME: Should enforce that is HTTP Status Code (undefined in spec)

    Response // FIXME: Allow Reference objects as well (using discriminated union?)
  )

  /** Describes a single operation parameter. 
   * A unique parameter is defined by a combination of a name and location. 
   * */
  const Parameter = t.type({

    /** The name of the parameter. 
     * Parameter names are case sensitive.
     * If in is "path", the name field MUST correspond to a template expression occurring within the path field in the Paths Object. 
     * See Path Templating for further information.
     * If in is "header" and the name field is "Accept", "Content-Type" or "Authorization", the parameter definition SHALL be ignored.
     * For all other cases, the name corresponds to the parameter name used by the in property. 
     * */
    name: t.string,

    /** The location of the parameter. */
    in: t.union([
      t.literal("query"),
      t.literal("header"),
      t.literal("path"),
      t.literal("cookie")
    ]),

    /** A brief description of the parameter. 
     * This could contain examples of use. 
     * CommonMark syntax MAY be used for rich text representation. 
     * */
    description: t.string,

    /** Determines whether this parameter is mandatory. 
     * If the parameter location is "path", this property is REQUIRED and its value MUST be true. 
     * Otherwise, the property MAY be included and its default value is false. 
     * */
    required: t.boolean,

    /** The schema defining the type used for the parameter. */
    schema: Schema // FIXME: Allow Reference objects as well (using discriminated union?)
  })

  /** Describes a single request body.
   * This object MAY be extended with Specification Extensions.
   */
  const RequestBody = t.intersection([
    t.type({

      /** The content of the request body. 
       * The key is a media type or media type range and the value describes it. 
       * For requests that match multiple keys, only the most specific key is applicable. 
       * e.g. text/plain overrides text/* 
       * */
      content: t.record(
        t.string,
        MediaType
      ),
    }),

    t.partial({

      /** Determines if the request body is required in the request. 
       * Defaults to false. 
       * */
      required: t.boolean,

      /** A brief description of the request body. 
       * This could contain examples of use. 
       * CommonMark syntax MAY be used for rich text representation.
       * */
      description: t.string,
    })
  ])

  /** Describes a single API operation on a path. 
   * This object MAY be extended with Specification Extensions.
   * */
  const Operation = t.type({

    /** A list of parameters that are applicable for this operation. 
     * If a parameter is already defined at the Path Item, the new definition will override it but can never remove it. 
     * The list MUST NOT include duplicated parameters. 
     * A unique parameter is defined by a combination of a name and location. 
     * The list can use the Reference Object to link to parameters that are defined at the OpenAPI Object's components/parameters. 
     * */
    parameters: t.array(Parameter), // FIXME: Allow Reference objects as well (using discriminated union?)

    /** The list of possible responses as they are returned from executing this operation. */
    responses: Responses,

    /** The request body applicable for this operation. 
     * The requestBody is only supported in HTTP methods where the HTTP 1.1 specification RFC7231 has explicitly defined semantics for request bodies. 
     * In other cases where the HTTP spec is vague, requestBody SHALL be ignored by consumers. 
     * */
    requestBody: RequestBody,
  })

  /** Holds a set of reusable objects for different aspects of the OAS. 
   * All objects defined within the components object will have no effect on the API unless they are explicitly referenced from properties outside the components object. 
   * */
  const Components = t.partial({

    /** An object to hold reusable Schema Objects. */
    schemas: t.record(t.string, Schema), // FIXME: Allow Reference objects as well (using discriminated union?)

    /** An object to hold reusable Response Objects. */
    responses: t.record(t.string, Response) // FIXME: Allow Reference objects as well (using discriminated union?)
  })

  const Server = t.intersection([
    t.type({

      /** A URL to the target host. 
       * This URL supports Server Variables and MAY be relative, to indicate that the host location is relative to the location where the OpenAPI document is being served. 
       * Variable substitutions will be made when a variable is named in {brackets}. 
       * */
      url: t.string
    }),

    t.partial({

      /** An optional string describing the host designated by the URL. 
       * CommonMark syntax MAY be used for rich text representation. 
       * */
      description: t.string,

      /** A map between a variable name and its value. 
       * The value is used for substitution in the server's URL template. 
       * FIXME: Implement value schema
       * */ 
      variables: t.record(t.string, t.null)
    })
  ])

  /** Describes the operations available on a single path. 
   * A Path Item MAY be empty, due to ACL constraints. 
   * The path itself is still exposed to the documentation viewer but they will not know which operations and parameters are available. 
   * This object MAY be extended with Specification Extensions.
   * */
  const PathItem = t.partial({

    /** A definition of a GET operation on this path. */
    get: Operation,

    /** A definition of a POST operation on this path. */
    post: Operation,

    /** A definition of a PUT operation on this path. */
    put: Operation,

    /** A definition of a PATCH operation on this path. */
    patch: Operation,

    /** A definition of a DELETE operation on this path. */
    delete: Operation,
  })

  /** Holds the relative paths to the individual endpoints and their operations. 
   * The path is appended to the URL from the Server Object in order to construct the full URL. 
   * The Paths MAY be empty, due to ACL constraints. 
   * This object MAY be extended with Specification Extensions.
   * */
  const Paths = t.record(

    /** A relative path to an individual endpoint. 
     * The field name MUST begin with a forward slash (/). 
     * The path is appended (no relative URL resolution) to the expanded URL from the Server Object's url field in order to construct the full URL. 
     * Path templating is allowed. 
     * When matching URLs, concrete (non-templated) paths would be matched before their templated counterparts. 
     * Templated paths with the same hierarchy but different templated names MUST NOT exist as they are identical.
     * In case of ambiguous matching, it's up to the tooling to decide which one to use. 
     * */
    t.string, // FIXME: Should enforce (using regex?): /{path}

    PathItem,
  )

  /** This is the root document object of the OpenAPI document. 
   * This object MAY be extended with Specification Extensions.
   * */
  const Document = t.type({

    /** This string MUST be the semantic version number of the OpenAPI Specification version that the OpenAPI document uses. 
     * The openapi field SHOULD be used by tooling specifications and clients to interpret the OpenAPI document. 
     * This is not related to the API info.version string. 
     * */
    openapi: t.string,

    /** Provides metadata about the API. 
     * The metadata MAY be used by tooling as required. 
     * */
    info: Info,

    /** The available paths and operations for the API. */
    paths: Paths,

    /** An array of Server Objects, which provide connectivity information to a target server. 
     * If the servers property is not provided, or is an empty array, the default value would be a Server Object with a url value of /. */
    servers: t.array(Server),

    /** An element to hold various schemas for the specification. */
    components: Components,
  })

  export const runtimeTypes = {
    Info,
    Schema,
    Reference,
    MediaType,
    Response,
    Responses,
    Parameter,
    RequestBody,
    Operation,
    Components,
    PathItem,
    Paths,
    Document
  }

  export type Compiletime<Name extends keyof typeof runtimeTypes> = t.TypeOf<typeof runtimeTypes[Name]>
}
