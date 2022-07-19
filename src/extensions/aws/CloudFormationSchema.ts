import * as t from 'io-ts'

export namespace CloudFormationSchema {

  const AttributeDefinition = t.type({
    // FIXME: Require Minimum: 1, Maximum: 255
    AttributeName: t.string,
    AttributeType: t.union([
      t.literal('S'),
      t.literal('N'),
      t.literal('B'),
    ])
  })

  const KeySchema = t.type({
    AttributeName: t.string,
    KeyType: t.union([
      t.literal('HASH'),
      t.literal('RANGE'),
    ])
  })

  const ProvisionedThroughput = t.type({
    ReadCapacityUnits: t.number,
    WriteCapacityUnits: t.number,
  })

  const Projection = t.type({
    ProjectionType: t.union([
      t.literal('KEYS_ONLY'),
      t.literal('INCLUDE'), // FIXME: Add NonKeyAttributes property, is it required for this case?
      t.literal('ALL'),
    ])
  })

  const GlobalSecondaryIndex = t.type({
    // FIXME: Require that it's unique among this table's indexes
    IndexName: t.string,
    KeySchema: t.array(KeySchema),
    Projection: Projection,
  })

  const Resource = t.type({ // extends AWSNonTransformResources
    Type: t.literal('AWS::DynamoDB::Table'),
    Properties: t.intersection([

      // Properties required no matter what
      t.type({
        // FIXME: Only required to create (not update?)
        AttributeDefinitions: t.array(AttributeDefinition),
        // FIXME: Require that all keys are also present in AttributeDefinitions
        KeySchema: t.array(KeySchema),
      }),

      // Properties optional no matter what
      t.partial({
        // FIXME: Require Minimum: 3, Maximum: 255, Pattern: [a-zA-Z0-9_.-]+
        TableName: t.string, 
      }),

      // Properties conditional on the billing mode
      t.union([

        // Pay Per Request mode
        t.intersection([
          t.type({
            BillingMode: t.literal('PAY_PER_REQUEST'),
          }),
          t.partial({
            // FIXME: Require non-empty (if not undefined) due to localstack (but seemingly not AWS) rqmt
            GlobalSecondaryIndexes: t.array(GlobalSecondaryIndex)
          })
        ]),

        // Provisioned mode
        t.intersection([
          t.partial({
            BillingMode: t.literal('PROVISIONED'),
            // FIXME: Require non-empty (if not undefined) due to localstack (but seemingly not AWS) rqmt
            GlobalSecondaryIndexes: t.array(t.intersection([
              GlobalSecondaryIndex,
              t.type({
                ProvisionedThroughput,
              }),
            ]))
          }),
          t.type({
            ProvisionedThroughput,
          }),
        ])
      ])
    ]) 
  })

  export const models = {
    AttributeDefinition,
    KeySchema,
    ProvisionedThroughput,
    Projection,
    GlobalSecondaryIndex,
    Resource
  }

  export type TypeOf<Name extends keyof typeof models> = t.TypeOf<typeof models[Name]>
}