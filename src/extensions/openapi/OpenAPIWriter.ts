import type * as t from 'io-ts'
import * as fs from 'fs'

import _ from 'lodash'
import YAML from 'yaml'

import { identity, Logger } from '../../core/Utilities';
import { RESTResource } from '../../core/RESTResource';
import type { VerdadRESTAPI } from "../../core/RESTAPI";
import type { ExcessType } from '../../core/ExcessType';
import type { OpenAPI } from "./OpenAPISchema"
import type { ISO } from '../../core/ISO';

// MARK: Built-in io-ts types
type TaggedType = t.NullType
  | t.UndefinedType
  | t.VoidType
  | t.UnknownType
  | t.StringType
  | t.NumberType
  | t.BigIntType
  | t.BooleanType
  | t.AnyArrayType
  | t.AnyDictionaryType
  | t.LiteralType<string | number | boolean>
  | t.KeyofType<{ [key: string]: unknown }>
  | t.RefinementType<TaggedType>
  | t.RecursiveType<TaggedType>
  | t.ArrayType<TaggedType>
  | t.InterfaceType<t.Props>
  | t.PartialType<t.Props>
  | t.DictionaryType<TaggedType, TaggedType>
  | t.UnionType<Array<TaggedType>>
  | t.IntersectionType<Array<TaggedType>>
  | t.TupleType<Array<TaggedType>>
  | t.ReadonlyType<TaggedType>
  | t.ReadonlyArrayType<TaggedType>
  | t.ExactType<TaggedType>
  | ISO.ISOType<any>

  // MARK: Deprecated io-ts types - not currently using but keeping for completeness
  // | t.FunctionType
  // | t.NeverType
  // | t.AnyType
  // | t.ObjectType
  // | t.StrictType<t.Props>

  // MARK: Custom types
  | ExcessType<t.Any>

type ParameterValueType = t.StringType | t.LiteralType<string>

type ParameterObjectType = t.InterfaceType<Record<string, ParameterValueType>>
  | t.PartialType<Record<string, ParameterValueType>>
  | t.IntersectionType<Array<ParameterObjectType>>

type UniqueMethod = {
  name: RESTResource.Method.Name,
  path: string,
  operation: OpenAPI.Compiletime<'Operation'>
}

export namespace OpenAPIWriter {

  export async function writeOpenAPIDocument(input: {
    api: VerdadRESTAPI.Definition<any, VerdadRESTAPI.Servers>,
    logger: Logger<any, any>,
    filePath: string,
  }) {

    function createOpenAPIDocument(api: VerdadRESTAPI.Definition<any, VerdadRESTAPI.Servers>): OpenAPI.Compiletime<'Document'> {
      var methods: UniqueMethod[] = []
      var models: RESTResource.Named<any, any>[] = []

      api.forEachMethod((method) => {

        const makeOperation = (): OpenAPI.Compiletime<'Operation'> => {
          return {
            parameters: [
              explodedParametersSafe(method.pathParametersType.runtimeType, 'path'),
              explodedParametersSafe(method.queryParametersType.runtimeType, 'query'),
              explodedParametersSafe(method.headerParametersType.runtimeType, 'header'),
            ].flatMap(identity),
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    $ref: `#/components/schemas/${method.requestBodyType.name}`
                  }
                }
              }
            },
            responses: {
              // FIXME: Use statusCodes from method definition
              200: {
                description: '',
                content: {
                  'application/json': {
                    schema: {
                      $ref: `#/components/schemas/${method.successResponse.bodyType.name}`
                    }
                  }
                },
              },
              500: {
                description: '',
                content: {
                  'application/json': {
                    schema: {
                      $ref: `#/components/schemas/${method.errorResponse.bodyType.name}`
                    }
                  }
                }
              }
            }
          }
        }

        models = models.concat([
          method.requestBodyType,
          method.successResponse.bodyType,
          method.errorResponse.bodyType
        ])

        methods.push({
          name: method.name,
          path: RESTResource.Path.stringify(method.path),
          operation: makeOperation()
        })
      })

      const pathItems: OpenAPI.Compiletime<'Paths'> = _(methods)
        .groupBy((method) => method.path)
        .mapValues((pathMethods) => {

          function makeNamedOperation<Name extends RESTResource.Method.Name>(
            name: Name
            // SAFETY: Because of empty object option, not enforced that name must be of correct type
          ): { [Property in Name]: OpenAPI.Compiletime<'Operation'> } | {} {
            const method = pathMethods.find((method) => method.name === name)
            return method === undefined ? {} : { [name]: method.operation }
          }

          // SAFETY: Not enforced that keys are unique in this mapping
          return {
            ...makeNamedOperation('get'),
            ...makeNamedOperation('post'),
            ...makeNamedOperation('put'),
            ...makeNamedOperation('patch'),
            ...makeNamedOperation('delete'),
          }
        })
        .value()

      const schemas = _(models)
        .keyBy((namedSchema) => namedSchema.name)
        .mapValues((namedSchema) => namedSchema.runtimeType)
        .mapValues(schemaForTypeSafe)
        .value()

      const servers = _(api.servers)
        .map((baseURL, serverName) => ({
          url: baseURL,
          description: serverName
        }))
        .value()

      // FIXME: Add servers dictionary
      return {
        openapi: '3.0.0',
        info: {
          title: `${api.name} APIs`,
          version: '0.1.0'
        },
        paths: pathItems,
        components: {
          schemas: schemas
        },
        servers: servers
      }
    }

    function schemaForTypeSafe(type: t.Any): OpenAPI.Compiletime<'Schema'> {
      const castedType = type as TaggedType

      const unsafeResult = schemaForType(castedType)
      if (unsafeResult === undefined) {
        input.logger?.log('warn', {}, {
          'category': 'Other',
          'event': 'Generic',
          metadata: {
            'message': `OpenAPI does not support io-ts type ${type.name} for type request or response body type`
          }
        })

        return {
          description: type.name
        }
      }

      return unsafeResult
    }

    function explodedParametersSafe(type: t.Any, location: 'query' | 'header' | 'path'): OpenAPI.Compiletime<'Parameter'>[] {
      const castedType = type as ParameterObjectType

      const unsafeResult = explodedParameters(castedType, location)
      if (unsafeResult === undefined) {
        throw Error(`OpenAPI does not support io-ts type ${type.name} for the ${location} parameter object type`)
      }

      return unsafeResult
    }

    function explodedParameters(type: ParameterObjectType, location: 'query' | 'header' | 'path'): OpenAPI.Compiletime<'Parameter'>[] {

      const explodedProps = (args: { props: Record<string, ParameterValueType>, required: boolean }): OpenAPI.Compiletime<'Parameter'>[] => {
        return _(args.props).map((value, name): OpenAPI.Compiletime<'Parameter'> => {
          return {
            description: '',
            name: name,
            in: location,
            schema: schemaForTypeSafe(value),
            required: args.required
          }
        }).value()
      }

      switch (type._tag) {
        case 'InterfaceType':
          return explodedProps({ props: type.props, required: true })
        case 'PartialType':
          return explodedProps({ props: type.props, required: false })

        case 'IntersectionType':
          return type.types.flatMap((subType) => explodedParametersSafe(subType, location))

        default:
          return []
          // throw Error(`Unexpected io-ts type for parameter object: ${Object.values(type)}`)
      }
    }

    function schemaForType(type: TaggedType): OpenAPI.Compiletime<'Schema'> {
      let schema: OpenAPI.Compiletime<'Schema'>

      switch (type._tag) {

        case 'UndefinedType':
          throw Error('OpenAPI does not support io-ts undefined type')

        case 'VoidType':
          throw Error('OpenAPI does not support io-ts void type')

        case 'UnknownType':
          schema = {}
          break;

        case 'NullType':
          schema = {
            type: 'null'
          }
          break;

        case 'StringType':
          schema = {
            type: 'string',
          }
          break;
        case 'NumberType':
          schema = {
            type: 'number'
          }
          break;
        case 'BigIntType':
          schema = {
            type: 'integer'
          }
          break;
        case 'BooleanType':
          schema = {
            type: 'boolean'
          }
          break;

        case 'AnyArrayType':
        case 'AnyDictionaryType':
          throw Error('OpenAPI does not support io-ts any types')

        case 'LiteralType':
          const valueType = typeof type.value as 'string' | 'number' | 'boolean'
          schema = {
            type: valueType,
            enum: [type.value]
          }
          break;

        case 'KeyofType':
          schema = {
            type: 'string',
            enum: Object.keys(type.keys)
          }
          break;

        case 'RefinementType':
          schema = {
            title: type.name,
            ...schemaForType(type.type)
          }
          break;

        case 'RecursiveType':
          schema = {}
          // schema = schemaForTypeSafe(type.type)
          break;

        case 'ArrayType':
          schema = {
            type: 'array',
            items: schemaForTypeSafe(type.type)
          }
          break;

        case 'InterfaceType':
          schema = {
            type: 'object',
            properties: _(type.props).mapValues(schemaForTypeSafe).value(),
            required: Object.keys(type.props)
          }
          break;

        case 'PartialType':
          schema = {
            type: 'object',
            properties: _(type.props).mapValues(schemaForTypeSafe).value()
          }
          break;

        case 'DictionaryType':
          if (type.domain._tag === 'StringType') {
            schema = {
              type: 'object',
              additionalProperties: schemaForTypeSafe(type.codomain)
            }
            break;
          } else {
            throw Error('OpenAPI does not support io-ts dictionary type with domain not of string type')
          }

        case 'UnionType':
          schema = {
            oneOf: type.types.map(schemaForTypeSafe)
          }
          break;

        case 'IntersectionType':
          schema = {
            allOf: type.types.map(schemaForTypeSafe)
          }
          break;

        case 'TupleType':
          throw Error('OpenAPI does not support io-ts tuple type')

        case 'ReadonlyType':
        case 'ReadonlyArrayType':
          schema = {
            type: 'array',
            items: schemaForTypeSafe(type.type)
          }
          break;
          // throw Error('OpenAPI does not support io-ts readonly types')

        case 'ExactType':
          throw Error('OpenAPI does not support io-ts exact type')

        case 'ExcessType':
          schema = schemaForTypeSafe(type.type)
          break;

        case 'Verdad.ISOType':
          schema = {
            type: 'string',
            title: type.name,
            description: 'See ISO specification for more details.'
          }
      }

      return schema
    }

    if (fs.existsSync(input.filePath)) {
      await fs.promises.rm(input.filePath)
    }

    const document = createOpenAPIDocument(input.api)
    const fileContents = YAML.stringify(document)//OpenAPI.Document.encode(document))
    await fs.promises.writeFile(input.filePath, fileContents);
  }
}