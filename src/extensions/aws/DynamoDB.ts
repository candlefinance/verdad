import _ from 'lodash'

import * as t from 'io-ts'
import * as E from 'fp-ts/Either'

import { pipe } from 'fp-ts/function'
import { AttributeValue, DynamoDB } from "@aws-sdk/client-dynamodb"

import type { VerdadNoSQLDB } from "../../core/NoSQLDB"
import { ArrayElementType, CodeContext, Logger, removeNilFields } from '../../core/Utilities'

export namespace VerdadDynamoDB {

  // FIXME: Use same 'join' helper function as CloudFormation.ts
  export class Interface<Tables extends VerdadNoSQLDB.NoSQLTables, DBStages extends VerdadNoSQLDB.DBStages> {
    noSQLDB; tablePrefix; dynamoDB; logger; dbStage

    private context: CodeContext = {
      module: 'verdad',
      directory: 'src/extensions/aws/',
      file: 'DynamoDB.ts',
      namespace: 'VerdadDynamoDB',
      class: 'Interface',
    }

    constructor(input: {
      noSQLDB: VerdadNoSQLDB.Definition<Tables, DBStages>,
      dbStage: ArrayElementType<DBStages> & string,
      tablePrefix: string,
      logger: Logger<any, any>
    }) {
      this.logger = input.logger
      this.noSQLDB = input.noSQLDB
      this.dbStage = input.dbStage
      this.tablePrefix = input.tablePrefix

      const optionalEndpoint = pipe(
        process.env['LOCALSTACK_HOSTNAME'],
        E.fromNullable({}),
        E.map((localstackHostname) => `http://${localstackHostname}:4566`),
        E.map((endpoint) => ({ endpoint })),
        E.toUnion,
      )

      this.dynamoDB = new DynamoDB({
        apiVersion: 'latest',
        region: 'us-east-1',
        ...optionalEndpoint
      });
    }

    // --- Generic accessor functions

    // FIXME: Enforce that tableName and tableDefinition match up
    // FIXME: Don't require table definition or secondary key type
    async getMatchingItems<
      Item,
      ItemRaw extends Record<string, AttributeValue>,
      SecondaryKeys extends string & keyof Item & keyof ItemRaw,
      SecondaryKey extends SecondaryKeys
    >(input: {
      tableName: keyof Tables & string,
      tableDefinition: VerdadNoSQLDB.TableDefinition<Item, ItemRaw, any, SecondaryKeys>
      secondaryKey: SecondaryKey
      secondaryKeyType: t.Type<Item[SecondaryKey], ItemRaw[SecondaryKey]>
      secondaryKeyValue: Item[SecondaryKey]
    }): Promise<Item[]> {
      const encodedSecondaryKey = input.secondaryKeyType.encode(input.secondaryKeyValue)

      const queryRequest = {
        TableName: this.qualify(input.tableName),
        IndexName: input.secondaryKey,
        ExpressionAttributeValues: { ':value': encodedSecondaryKey },
        KeyConditionExpression: `${input.secondaryKey} = :value`
      }

      this.logger.log('info', {
        ...this.context,
        function: 'getMatchingItems'
      }, {
        category: 'DynamoDBRequest',
        event: 'Query',
        metadata: {
          tableName: queryRequest.TableName,
          secondaryIndexName: queryRequest.IndexName
        }
      })

      const queryResponse = await this.dynamoDB.query(queryRequest)

      if (queryResponse.Items === undefined) {
        throw Error("No Items returned from DynamoDB")
      } else {
        // FIXME: .runtimeType is <any, any>
        const decodedItem = t.array(input.tableDefinition.runtimeType).decode(queryResponse.Items)

        if (E.isRight(decodedItem)) {
          return decodedItem.right
        } else {
          throw Error(`Item returned from DynamoDB has invalid schema: ${JSON.stringify(decodedItem.left)}`)
        }
      }
    }

    // FIXME: Enforce that tableName and tableDefinition match up
    // FIXME: Don't require table definition or primary key type
    async getItem<
      Item,
      ItemRaw extends Record<string, AttributeValue>,
      PrimaryKey extends string & keyof Item & keyof ItemRaw
    >(input: {
      tableName: keyof Tables & string,
      tableDefinition: VerdadNoSQLDB.TableDefinition<Item, ItemRaw, PrimaryKey, any>
      primaryKeyType: t.Type<Item[PrimaryKey], ItemRaw[PrimaryKey]>
      primaryKeyValue: Item[PrimaryKey]
    }): Promise<Item | undefined> {
      const encodedPrimaryKeyValue = input.primaryKeyType.encode(input.primaryKeyValue)

      const getRequest = {
        TableName: this.qualify(input.tableName),
        Key: { [input.tableDefinition.primaryKey]: encodedPrimaryKeyValue }
      }

      this.logger.log('info', {
        ...this.context,
        function: 'getItem'
      }, {
        category: 'DynamoDBRequest',
        event: 'GetItem',
        metadata: {
          tableName: getRequest.TableName,
        }
      })

      const getResponse = await this.dynamoDB.getItem(getRequest)

      if (getResponse.Item === undefined) {
        return undefined
      } else {
        const decodedItem = input.tableDefinition.runtimeType.decode(getResponse.Item)

        if (E.isRight(decodedItem)) {
          return decodedItem.right
        } else {
          throw Error(`Item returned from DynamoDB has invalid schema: ${JSON.stringify(decodedItem.left)}`)
        }
      }
    }

    // FIXME: Enforce that tableName and tableDefinition match up
    // FIXME: Don't require table definition
    async setItem<
      Item,
      ItemRaw extends Record<string, AttributeValue>,
    >(input: {
      tableName: keyof Tables & string,
      tableDefinition: VerdadNoSQLDB.TableDefinition<Item, ItemRaw, any, any>
      item: Item
    }): Promise<void> {
      const encodedItem = input.tableDefinition.runtimeType.encode(input.item)

      const putRequest = {
        TableName: this.qualify(input.tableName),
        Item: removeNilFields(encodedItem)
      }

      this.logger.log('info', {
        ...this.context,
        function: 'setItem'
      }, {
        category: 'DynamoDBRequest',
        event: 'PutItem',
        metadata: {
          tableName: putRequest.TableName,
        }
      })

      // FIXME: Implement locks: ConsistentRead on Query, and/or getAccountForRequestUse conditional expression with 'attribute_not_exists' to block overwrites
      await this.dynamoDB.putItem(putRequest)
    }

    // FIXME: Enforce that tableName and tableDefinition match up
    // FIXME: Don't require table definition or primary key type
    async deleteItem<
      Item,
      ItemRaw extends Record<string, AttributeValue>,
      PrimaryKey extends string & keyof Item & keyof ItemRaw
    >(input: {
      tableName: keyof Tables & string,
      tableDefinition: VerdadNoSQLDB.TableDefinition<Item, ItemRaw, PrimaryKey, any>
      primaryKeyType: t.Type<Item[PrimaryKey], ItemRaw[PrimaryKey]>
      primaryKeyValue: Item[PrimaryKey]
    }): Promise<void> {
      const encodedPrimaryKey = input.primaryKeyType.encode(input.primaryKeyValue)

      const deleteRequest = {
        TableName: this.qualify(input.tableName),
        Key: { [input.tableDefinition.primaryKey]: encodedPrimaryKey }
      }

      this.logger.log('info', {
        ...this.context,
        function: 'deleteItem'
      }, {
        category: 'DynamoDBRequest',
        event: 'DeleteItem',
        metadata: {
          tableName: deleteRequest.TableName,
        }
      })

      await this.dynamoDB.deleteItem(deleteRequest)
    }

    private qualify<TK extends keyof Tables>(tableName: TK & string) {
      return [this.tablePrefix, this.dbStage, tableName].join('-')
    }
  }
}