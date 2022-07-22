import consoleLogLevel from 'console-log-level'

import * as t from 'io-ts'
import * as uuid from 'uuid'

import { JsonRecord, UUID } from 'io-ts-types'

export const CodeContext = t.partial({
  module: t.string,
  directory: t.string,
  file: t.string,
  namespace: t.string,
  class: t.string,
  function: t.string,
  // FIXME: Add line and column numbers
})

export const LogItem = t.union([
  t.intersection([
    t.type({
      category: t.literal('StoredDataUpdate'),
    }),
    t.type({
      event: t.union([
        t.literal('NilValueOverwritten'),
        t.literal('SameValueOverwritten'),
        // FIXME: Add failed case, currently it's a thrown error
        // t.literal('OverwriteNotAllowed'),
      ]),
      metadata: t.type({
        tableName: t.string,
        fieldName: t.string,
      })
    }),
  ]),
  t.intersection([
    t.type({
      category: t.literal('Tests'),
    }),
    // t.union([
    t.type({
      event: t.literal('AssertEqualPassed'),
      metadata: t.type({
        value: t.unknown,
        description: t.string
      })
    }),
    // FIXME: Add failed case, currently it's a thrown error
    //   t.type({
    //     event: t.literal('AssertEqualFailed'),
    //     metadata: t.type({
    //       supportedVersions: t.array(t.string),
    //     })
    //   })
    // ])
  ]),
  t.intersection([
    t.type({
      category: t.literal('StoredDataMigration'),
    }),
    t.union([
      t.type({
        event: t.literal('MigrationPerformed'),
        metadata: t.type({
          fromVersion: t.string,
          toVersion: t.string,
        })
      }),
      t.type({
        event: t.literal('NoMigrationPerformed'),
        metadata: t.type({
          supportedVersions: t.array(t.string),
        })
      })
    ])
  ]),
  t.intersection([
    t.type({
      category: t.literal('DynamoDBRequest'),
    }),
    t.union([
      t.type({
        event: t.union([
          t.literal('PutItem'),
          t.literal('GetItem'),
          t.literal('DeleteItem')
        ]),
        metadata: t.type({
          tableName: t.string,
          // FIXME: Add itemSize
        })
      }),
      t.type({
        event: t.literal('Query'),
        metadata: t.type({
          tableName: t.string,
          secondaryIndexName: t.string,
          // FIXME: Add itemSize
        })
      })
    ]),
  ]),
  t.type({
    category: t.literal('Other'),
    event: t.literal('Generic'),
    metadata: t.type({
      message: t.string,
    })
  }),
  t.type({
    placeholder: t.void
  })
])

export type LogItem = t.TypeOf<typeof LogItem>
export type CodeContext = t.TypeOf<typeof CodeContext>
export type LogLevel = consoleLogLevel.LogLevelNames

// FIXME: Rename generic param to InvocationContext
export class Logger<AppContext, AppContextRaw extends JsonRecord> {
  private appContextType: t.Type<AppContext, AppContextRaw>
  private appContext: AppContext
  private invocationID = uuid.v4() as UUID
  private consoleLogger: consoleLogLevel.Logger

  constructor(input: {
    appContextType: t.Type<AppContext, AppContextRaw>,
    initialAppContext: AppContext,
    minimumVisibleLevel: LogLevel
  }) {
    this.appContext = input.initialAppContext
    this.appContextType = input.appContextType
    this.consoleLogger = consoleLogLevel({
      level: input.minimumVisibleLevel
    })
  }

  // FIXME: Take a Partial?
  updateAppContext(newAppContext: AppContext) {
    this.appContext = newAppContext
  }

  log(
    level: LogLevel,
    codeContext: CodeContext,
    item: LogItem
  ) {
    const combinedType = t.intersection([
      LogItem,
      t.type({
        codeContext: CodeContext,
        invocationID: UUID,
        appContext: this.appContextType
      }),
    ])
    const encodedItem = combinedType.encode({
      ...item,
      codeContext: codeContext,
      invocationID: this.invocationID,
      appContext: this.appContext
    })
    const serializedItem = JSON.stringify(encodedItem)

    this.consoleLogger[level](`VERDAD ${serializedItem}`)
  }
}