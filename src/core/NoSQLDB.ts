import type * as t from 'io-ts'

import type { AttributeValue } from "@aws-sdk/client-dynamodb"

export namespace VerdadNoSQLDB {

  export type NoSQLTables = Record<string, TableDefinition<any, any, any, any>>
  export type DBStages = string[]

  export type Definition<Tables extends NoSQLTables, Stages extends DBStages> = {
    dbStages: Stages,
    tables: Tables
  }

  export function db<Tables extends NoSQLTables, Stages extends DBStages>(
    dbStages: Stages,
    tables: Tables,
  ): Definition<Tables, Stages> {
    return {
      dbStages: dbStages,
      tables
    }
  }

  export type TableDefinition<
    Item,
    ItemRaw extends Record<string, AttributeValue>,
    PrimaryKey extends string & keyof Item & keyof ItemRaw,
    SecondaryKeys extends string & keyof Item & keyof ItemRaw
    > = {
      runtimeType: t.Type<Item, ItemRaw>
      primaryKey: PrimaryKey
      secondaryKeys?: SecondaryKeys[]
    }

  export function table<
    Item,
    ItemRaw extends Record<string, AttributeValue>,
    PrimaryKey extends string & keyof Item & keyof ItemRaw,
    SecondaryKeys extends string & keyof Item & keyof ItemRaw
  >(input: {
    runtimeType: t.Type<Item, ItemRaw>
    primaryKey: PrimaryKey,
    secondaryKeys?: SecondaryKeys[] // FIXME: Block use of empty []
  }): TableDefinition<Item, ItemRaw, PrimaryKey, SecondaryKeys> {
    return input
  }
}