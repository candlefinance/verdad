import * as A from 'fp-ts/Array'
import * as O from 'fp-ts/Option'
import * as R_ext from 'fp-ts-std/Record'
import * as R from 'fp-ts/Record'

import type { AWS, AwsIamPolicyStatements } from '@serverless/typescript';
import { identity, pipe } from 'fp-ts/function';

import { RESTResource } from "../../core/RESTResource";
import type { VerdadRESTAPI } from '../../core/RESTAPI';
import type { VerdadNoSQLDB } from '../../core/NoSQLDB';

import type { ArrayElementType } from '../../core/utilities/types';
import { join, mapKeys, wrappedIfSome } from '../../core/utilities/fp';

import type { CloudFormationSchema } from './CloudFormationSchema';

// FIXME: Make class with initializer that takes (and types) the API
export namespace VerdadCloudFormation {

  export function makeServerlessFunctions(api: VerdadRESTAPI.Definition<any, any>) {

    var functions: Exclude<AWS['functions'], undefined> = {}

    type MakeHandlerPathInput = {
      filePathComponents: string[],
      functionName: string
    }

    function makeHandlerPath(input: MakeHandlerPathInput): string {
      const filePath = pipe(input.filePathComponents,
        A.prepend('resources'),
        A.prepend('src'),
        join('/')
      )

      return pipe([filePath, input.functionName],
        join('.')
      )
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
      const pathLiteralComponentsOnly = pipe(method.path,
        A.map((component) => typeof component === 'string' ? O.some(component) : O.none),
        A.compact
      )

      const awsFunctionName = pipe(pathLiteralComponentsOnly,
        A.prepend(method.name.toUpperCase()),
        join("-"),
      )

      const functionHandlerPath = pipe(pathLiteralComponentsOnly, A.appendW(method.name))

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
    DBStage extends VerdadNoSQLDB.DBStage,
    >(
      noSQLDB: VerdadNoSQLDB.Definition<T, DBStage>,
      awsRegion: string,
      awsAccountID: string,
  ): AwsIamPolicyStatements {

    return pipe(noSQLDB.dbStages,
      A.chain((dbStage): AwsIamPolicyStatements => pipe(noSQLDB.tables,
        R.mapWithIndex((rawTableName, tableSpec): AwsIamPolicyStatements => {
          const tableResourceARN = `arn:aws:dynamodb:${awsRegion}:${awsAccountID}:table/${qualifiedTableName({
            prefix: '*',
            tableName: rawTableName,
            dbStage,
          })}`

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
            Resource: tableResourceARN
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
            Resource: `${tableResourceARN}/index/${secondaryKey}`
          }))

          return globalSecondaryIndexesPermissions.concat(tablePermissions)
        }),
        R_ext.values,
        A.flatten,
      ))
    )
  }

  export function makeDynamoDBTables<
    T extends VerdadNoSQLDB.NoSQLTables,
    DBStage extends VerdadNoSQLDB.DBStage,
    >(
      noSQLDB: VerdadNoSQLDB.Definition<T, DBStage>,
      prefix: string,
  ): Record<string, CloudFormationSchema.TypeOf<'Resource'>> {

    return pipe(noSQLDB.dbStages,
      A.map((dbStage): Record<string, CloudFormationSchema.TypeOf<'Resource'>> => pipe(noSQLDB.tables,
        R.mapWithIndex((rawTableName, tableSpec): CloudFormationSchema.TypeOf<'Resource'> => {
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
              TableName: qualifiedTableName({ prefix, dbStage, tableName: rawTableName }),
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
        }),
        mapKeys(rawTableName => [rawTableName, dbStage].join('FOR'))
      )),
      A.reduce({}, (allResources, thisDBStageResources) => R.union({ concat: identity })(allResources)(thisDBStageResources)),
    )
  }

  export function qualifiedTableName<
    T extends VerdadNoSQLDB.NoSQLTables,
    DBStage extends VerdadNoSQLDB.DBStage,
    >(input: {
      prefix: string,
      dbStage: DBStage,
      tableName: keyof T
    }): string {
    return [input.prefix, input.dbStage, input.tableName].join('-')
  }
}