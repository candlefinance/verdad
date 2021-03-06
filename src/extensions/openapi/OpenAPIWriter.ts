import YAML from 'yaml'

import type * as t from 'io-ts'
import * as fs from 'fs'
import * as NEA from 'fp-ts/NonEmptyArray'
import * as R from 'fp-ts/Record'
import * as R_std from 'fp-ts-std/Record'

import { identity, pipe } from 'fp-ts/function'

import { RESTResource } from '../../core/RESTResource';
import type { VerdadRESTAPI } from "../../core/RESTAPI";
import type { ExcessType } from '../../core/ExcessType';
import type { ISO } from '../../core/ISO';

import type { Logger } from '../../core/utilities/logger';

import type { OpenAPI } from "./OpenAPISchema"

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
  operation: OpenAPI.TypeOf<'Operation'>
}

export namespace OpenAPIWriter {

  export async function writeOpenAPIDocument(input: {
    api: VerdadRESTAPI.Definition<any, VerdadRESTAPI.Servers>,
    logger: Logger<any, any>,
    filePath: string,
  }) {

    function createOpenAPIDocument(api: VerdadRESTAPI.Definition<any, VerdadRESTAPI.Servers>): OpenAPI.TypeOf<'Document'> {
      var methods: UniqueMethod[] = []
      var models: t.Type<any, any>[] = []

      api.forEachMethod((method) => {

        const makeOperation = (): OpenAPI.TypeOf<'Operation'> => {
          return {
            parameters: [
              explodedParametersSafe(method.pathParametersType, 'path'),
              explodedParametersSafe(method.queryParametersType, 'query'),
              explodedParametersSafe(method.headerParametersType, 'header'),
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

      const pathItems: OpenAPI.TypeOf<'Paths'> = pipe(methods,
        NEA.groupBy((method) => method.path),
        R.map((pathMethods) => {

          function makeNamedOperation<Name extends RESTResource.Method.Name>(
            name: Name
            // SAFETY: Because of empty object option, not enforced that name must be of correct type
          ): { [Property in Name]: OpenAPI.TypeOf<'Operation'> } | {} {
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
      )

      const schemas = pipe(models,
        NEA.groupBy((namedSchema) => namedSchema.name),
        R.map(NEA.head),
        R.map(schemaForTypeSafe)
      )

      const servers = pipe(api.servers,
        R.mapWithIndex((serverName, baseURL) => ({
          url: baseURL,
          description: serverName
        })),
        R_std.values
      )

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

    function schemaForTypeSafe(type: t.Any): OpenAPI.TypeOf<'Schema'> {
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

    function explodedParametersSafe(type: t.Any, location: 'query' | 'header' | 'path'): OpenAPI.TypeOf<'Parameter'>[] {
      const castedType = type as ParameterObjectType

      const unsafeResult = explodedParameters(castedType, location)
      if (unsafeResult === undefined) {
        throw Error(`OpenAPI does not support io-ts type ${type.name} for the ${location} parameter object type`)
      }

      return unsafeResult
    }

    function explodedParameters(type: ParameterObjectType, location: 'query' | 'header' | 'path'): OpenAPI.TypeOf<'Parameter'>[] {

      const explodedProps = (args: { props: Record<string, ParameterValueType>, required: boolean }): OpenAPI.TypeOf<'Parameter'>[] => {
        return pipe(args.props,
          R.mapWithIndex((name, value): OpenAPI.TypeOf<'Parameter'> => ({
            description: '',
            name: name,
            in: location,
            schema: schemaForTypeSafe(value),
            required: args.required
          })),
          R_std.values
        )
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

    function schemaForType(type: TaggedType): OpenAPI.TypeOf<'Schema'> {
      let schema: OpenAPI.TypeOf<'Schema'>

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
            properties: pipe(type.props, R.map(schemaForTypeSafe)),
            required: Object.keys(type.props)
          }
          break;

        case 'PartialType':
          schema = {
            type: 'object',
            properties: pipe(type.props, R.map(schemaForTypeSafe))
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