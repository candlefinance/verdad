import _ from 'lodash'

import type { AWS, AwsIamPolicyStatements } from '@serverless/typescript';

import { RESTResource } from "../../core/RESTResource";
import type { VerdadRESTAPI } from '../../core/RESTAPI';
import { ArrayElementType, wrappedIfSome } from '../../core/Utilities';
import type { CloudFormationSchema } from './CloudFormationSchema';
import type { VerdadNoSQLDB } from '../../core/NoSQLDB';

// FIXME: Make class with initializer that takes (and types) the API
export namespace VerdadCloudFormation {

  export function makeServerlessFunctions(api: VerdadRESTAPI.Definition<any, any>) {

    var functions: Exclude<AWS['functions'], undefined> = {}

    type MakeHandlerPathInput = {
      filePathComponents: _.Collection<string>,
      functionName: string
    }

    function makeHandlerPath(input: MakeHandlerPathInput): string {
      const filePath = input.filePathComponents
        .unshift('resources')
        .unshift('src')
        .join('/')

      return _([filePath, input.functionName])
        .join('.')
    }

    function makeFunctionForMethod<
      // Request Models
      Path, PathRaw extends RESTResource.StringRaw<Path>,
      Query, QueryRaw extends RESTResource.StringRaw<Query>,
      Header, HeaderRaw extends RESTResource.StringRaw<Header>,
      Request, RequestRaw,
      // Response Models
      SuccessResponseStatusCodes extends number, SuccessResponse, SuccessResponseRaw,
      ErrorResponseStatusCodes extends number, ErrorResponse, ErrorResponseRaw
    >(
      method: RESTResource.Method.Definition<
        // Request Models
        Path, PathRaw,
        Query, QueryRaw,
        Header, HeaderRaw,
        Request, RequestRaw,
        // Response Models
        SuccessResponseStatusCodes, SuccessResponse, SuccessResponseRaw,
        ErrorResponseStatusCodes, ErrorResponse, ErrorResponseRaw
      >
    ) {
      const pathLiteralComponentsOnly = _(method.path)
        .map((component) => {
          if (typeof component === 'string') {
            return component
          } else {
            return undefined
          }
        })
        .compact()

      const awsFunctionName = pathLiteralComponentsOnly
        // .map((component) => component.slice(undefined, 3))
        .unshift(method.name.toUpperCase())
        .join("-")

      const functionHandlerPath = pathLiteralComponentsOnly.push(method.name)

      const functionHandlerName = makeHandlerPath({
        filePathComponents: functionHandlerPath,
        functionName: 'verdadMain'
      })

      // NOTE: This only creates one API Gateway (& Lambda) method per unique path-method combination.
      // You can take advantage of this behavior to define multiple versions of the same method with different request & response types.
      functions[awsFunctionName] = {
        handler: functionHandlerName,
        timeout: 30,
        events: [
          {
            http: {
              method: method.name,
              path: RESTResource.Path.stringify(method.path),
            }
          }
        ]
      }
    }

    api.forEachMethod(makeFunctionForMethod)
    return functions
  }

  // FIXME: Define detailed types for IAM Policy Statements
  // FIXME: Move these generator functions into Verdad
  export function makeDynamoDBTablePermissions<
    T extends VerdadNoSQLDB.NoSQLTables,
    DBS extends VerdadNoSQLDB.DBStages,
    >(
      noSQLDB: VerdadNoSQLDB.Definition<T, DBS>,
  ): AwsIamPolicyStatements {

    return _(noSQLDB.dbStages)
      .flatMap((dbStage): AwsIamPolicyStatements => _(noSQLDB.tables)
        .mapKeys((_, rawTableName) => [rawTableName, dbStage].join('FOR'))
        .flatMap((tableSpec, tableKey): AwsIamPolicyStatements => {

          const tablePermissions: ArrayElementType<AwsIamPolicyStatements> = {
            Effect: "Allow",
            Action: [
              "dynamodb:Query",
              "dynamodb:Scan",
              "dynamodb:GetItem",
              "dynamodb:PutItem",
              "dynamodb:UpdateItem",
              "dynamodb:DeleteItem"
            ],
            Resource: {
              "Fn::GetAtt": [tableKey, "Arn"]
            }
          }

          if (tableSpec.secondaryKeys === undefined) {
            return [tablePermissions]
          }

          const globalSecondaryIndexesPermissions: AwsIamPolicyStatements = tableSpec.secondaryKeys.map((secondaryKey) => ({
            Effect: "Allow",
            Action: [
              "dynamodb:Query",
              "dynamodb:Scan",
              "dynamodb:GetItem",
              "dynamodb:PutItem",
              "dynamodb:UpdateItem",
              "dynamodb:DeleteItem"
            ],
            Resource: {
              "Fn::Join": [
                '/', [
                  {
                    "Fn::GetAtt": [tableKey, "Arn"]
                  },
                  'index',
                  secondaryKey
                ]
              ]
            }
          }))

          return globalSecondaryIndexesPermissions.concat(tablePermissions)
        })
        .value()
      )
      .value()
  }

  export function makeDynamoDBTables<
    T extends VerdadNoSQLDB.NoSQLTables,
    DBS extends VerdadNoSQLDB.DBStages,
    >(
      noSQLDB: VerdadNoSQLDB.Definition<T, DBS>,
      prefix: string,
  ): Record<string, CloudFormationSchema.TypeOf<'Resource'>> {

    return _(noSQLDB.dbStages)
      .map((dbStage): Record<string, CloudFormationSchema.TypeOf<'Resource'>> => _(noSQLDB.tables)
        .mapValues((tableSpec, rawTableName): CloudFormationSchema.TypeOf<'Resource'> => {
          // FIXME: tableSpec is untyped
          const secondaryKeys: string[] = tableSpec.secondaryKeys ?? []
          const allKeys = secondaryKeys.concat(tableSpec.primaryKey)

          const globalSecondaryIndexes = secondaryKeys.map((secondaryKey) => ({
            IndexName: secondaryKey,
            KeySchema: [
              {
                AttributeName: secondaryKey,
                KeyType: 'HASH' as const
              }
            ],
            Projection: {
              ProjectionType: 'ALL' as const
            },
          }))

          return {
            Type: 'AWS::DynamoDB::Table' as const,
            Properties: {
              // FIXME: Use same helper function that runtime logic uses
              TableName: [prefix, dbStage, rawTableName].join('-'),
              AttributeDefinitions: allKeys.map((key) => ({
                AttributeName: key,
                AttributeType: 'S' as const
              })),
              KeySchema: [
                {
                  AttributeName: tableSpec.primaryKey,
                  KeyType: 'HASH' as const
                }
              ],
              // NOTE: If we don't specify this, it defaults to PROVISIONED and we get billed lots of money
              BillingMode: 'PAY_PER_REQUEST',
              ...wrappedIfSome('GlobalSecondaryIndexes', globalSecondaryIndexes.length === 0 ? undefined : globalSecondaryIndexes)
            }
          }
        })
        // FIXME: Create helper function for this and identical logic above
        .mapKeys((_, rawTableName) => [rawTableName, dbStage].join('FOR'))
        .value()
      )
      .reduce((allResources, thisDBStageResources) => allResources.merge(thisDBStageResources), _({}))
      .value()
  }
}
