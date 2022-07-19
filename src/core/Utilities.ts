import consoleLogLevel from 'console-log-level'
import _ from 'lodash'

import * as t from "io-ts";
import * as A from 'fp-ts/Array'
import * as O from 'fp-ts/Option'
import * as E from 'fp-ts/Either'
import * as uuid from 'uuid'
import * as util from 'util'

import { flow, pipe } from "fp-ts/function";
import { BooleanFromString, JsonRecord, NumberFromString, UUID } from "io-ts-types";

// FIXME: Make Utilities namespace

// --- Collection element types

export type RecordKeyType<RecordType> = RecordType extends Record<infer Key, any> ? Key : never 
export type RecordValueType<RecordType> = RecordType extends Record<any, infer Value> ? Value : never

export type ArrayElementType<ArrayType> = ArrayType extends Array<infer Element> ? Element : never

// --- Number range types

type PrependNextNum<A extends Array<unknown>> = A['length'] extends infer T ? ((t: T, ...a: A) => void) extends ((...x: infer X) => void) ? X : never : never;
type EnumerateInternal<A extends Array<unknown>, N extends number> = { 0: A, 1: EnumerateInternal<PrependNextNum<A>, N> }[N extends A['length'] ? 0 : 1];

export type Enumerate<N extends number> = EnumerateInternal<[], N> extends (infer E)[] ? E : never;
export type Range<FROM extends number, TO extends number> = Exclude<Enumerate<TO>, Enumerate<FROM>>;

// --- Logging

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

// --- Case insensitive types

export type CaseInsensitiveProps<Props extends t.Props> = {
  [PropName in keyof Props as Lowercase<PropName & string>]: Props[PropName]
}

function caseInsensitive<
  Props extends t.Props,
  Type extends t.TypeC<CaseInsensitiveProps<Props>> | t.PartialC<CaseInsensitiveProps<Props>>
>(
  typeConstructor: new (
    name: string,
    is: t.Is<t.TypeOf<Type>>,
    validate: t.Validate<t.InputOf<Type>, t.TypeOf<Type>>,
    encode: t.Encode<t.TypeOf<Type>, t.OutputOf<Type>>,
    props: CaseInsensitiveProps<Props>
  ) => Type,
  typeStaticBuilder: (props: CaseInsensitiveProps<Props>) => Type,
  props: Props
): Type {
  return pipe(
    _(props).mapKeys((_, key) => key.toLowerCase()).value() as CaseInsensitiveProps<Props>,
    typeStaticBuilder,
    (lowercasedType) => new typeConstructor(
      `CaseInsensitive<${lowercasedType.name}>`,
      (unknown): unknown is t.TypeOf<Type> => lowercasedType.is(unknown),
      (unknown, context) => pipe(
        t.record(t.string, t.unknown).validate(unknown, context),
        // NOTE: Without the "in props" check, we might create (lowercased) keys NOT specified by props,
        // but which may be specified by other types used in an intersection.
        // If two sides of an intersection modify/define a key, io-ts doesn't know which value to choose.
        E.map((record) => _(record)
          .mapKeys((_, key) => pipe(
            key.toLowerCase(),
            (lowercasedKey) => lowercasedKey in lowercasedType.props ? lowercasedKey : key
          ))
          .value()
        ),
        E.chain(
          (lowercasedRecord) => lowercasedType.validate(lowercasedRecord, context)
        ),
      ),
      (value) => lowercasedType.encode(value),
      lowercasedType.props
    ),
  )
}

export function caseInsensitiveType<
  Props extends t.Props,
>(
  props: Props
): t.TypeC<CaseInsensitiveProps<Props>> {
  return caseInsensitive(t.InterfaceType, t.type, props)
}

export function caseInsensitivePartial<
  Props extends t.Props,
>(
  props: Props
): t.PartialC<CaseInsensitiveProps<Props>> {
  return caseInsensitive(t.PartialType, t.partial, props)
}

// --- Enum type that handles unexpected cases

export type HandleUnexpected<Cases> = {
  expected: true,
  value: Cases
} | {
  expected: false
  value: string,
}

// FIXME: Just returns string for some reason
export type Expected<HandleUnexpectedType> = HandleUnexpectedType extends HandleUnexpected<infer Cases> ? Cases : never

export class HandleUnexpectedType<Cases extends string> extends t.Type<
  HandleUnexpected<Cases>,
  string
> {
  constructor(casesType: t.Type<Cases, string>) {
    super(
      `HandleUnexpected<${casesType.name}>`,
      (unknown): unknown is HandleUnexpected<Cases> => casesType.is(unknown), // FIXME: Check for unknown case too
      (unknown, context) => {
        return pipe(
          t.string.validate(unknown, context),
          E.map((string) => pipe(
            casesType.validate(string, context),
            E.map((validatedCase): HandleUnexpected<Cases> => ({
              expected: true,
              value: validatedCase
            })),
            E.getOrElse((): HandleUnexpected<Cases> => ({
              expected: false,
              value: string
            }))
          ))
        )
      },
      (type) => type.value
    )
  }
}

// --- Primitive type brands

export function makePrimitiveBrand<C extends t.Any, N extends string, B extends {
  readonly [K in N]: symbol
}>(codec: C, name: N) {
  return t.brand(codec, (x): x is t.Branded<string, B> => { x; return true }, name)
}

// --- String to number literal decoder

class LiteralFromString<Type extends string | number | boolean, Literal extends Type> extends t.Type<Literal, string> {
  constructor(literalType: t.LiteralC<Literal>, transformerType: t.Type<Type, string>) {
    super(
      'x',
      literalType.is,
      (unknown, context) => pipe(
        transformerType.validate(unknown, context),
        E.chain((transformed) => literalType.validate(transformed, context))
      ),
      flow(
        literalType.encode, // NOTE: This step isn't really necessary; it's a no-op
        transformerType.encode
      )
    )
  }
}

export class BooleanLiteralFromString<Literal extends boolean> extends LiteralFromString<boolean, Literal> {
  constructor(literalValue: Literal) { super(t.literal(literalValue), BooleanFromString) }
}
export class NumberLiteralFromString<Literal extends number> extends LiteralFromString<number, Literal> {
  constructor(literalValue: Literal) { super(t.literal(literalValue), NumberFromString) }
}

export class CommaSeparated<Element> extends t.Type<Element[], string> {
  constructor(elementType: t.Type<Element, string>) {
    const empty: Element[] = []
    super(
      `CommaSeparated<${elementType.name}>`,
      t.array(elementType).is,
      (unknown, context) => pipe(
        t.string.validate(unknown, context),
        E.map((commaSeparatedValues) => commaSeparatedValues.split(',')),
        E.chain(flow(
          A.map((element) => elementType.validate(element, context)),
          A.reduce(E.right(empty), (previousElements, element) => {
            if (E.isRight(element)) {
              if (E.isRight(previousElements)) {
                return E.right([...previousElements.right, element.right])
              } else {
                return previousElements
              }
            } else {
              if (E.isRight(previousElements)) {
                return E.left(element.left)
              } else {
                return E.left([...previousElements.left, ...element.left])
              }
            }
          })
        )),
      ),
      flow(
        A.map((element) => elementType.encode(element)),
        (array) => array.join(',')
      )
    )
  }
}

// --- Tuple fill functions

export function fillE1<E0>(e0: E0): [E0, E0] {
  return [e0, e0]
}

// --- JSON types

export namespace JSON {
  export type Value = JSON.Number | JSON.String | JSON.Boolean | JSON.Array | JSON.Object

  export type Number = number
  export type String = string
  export type Boolean = boolean
  export type Array = JSON.Value[]
  export type Object = { [x: string]: JSON.Value }
}

// --- Functional utilities

// TODO: Make .reversed() that's non-mutating

export const wrappedIfSome = <Key extends string, Value>(key: Key, value: Value): { [K in Key]: NonNullable<Value> } | {} => pipe(
  value,
  E.fromNullable({}),
  E.map((nonNullableValue) => ({ [key]: nonNullableValue })),
  E.toUnion
)

export const identity = <T>(value: T) => value
export const run = <T>(generator: () => T) => generator()
// FIXME: If T is the result of a function call, calling this wrapper 'lazy' is misleading
export const lazy = <T>(value: T) => () => value

export function propertyIfAllEqual<T, U>(collection: T[], propertyAccessor: (element: T) => U): U {

  const firstProperty = pipe(
    collection[0],
    O.fromNullable,
    O.map(propertyAccessor),
    O.toUndefined
  )

  if (firstProperty === undefined) {
    throw Error("Cannot get property from an empty array")
  }

  if (_(collection).every((element) => propertyAccessor(element) === firstProperty)) {
    return firstProperty
  } else {
    throw Error("Not all properties in this array are equal")
  }
}

export const removeNilFields = <T extends object>(object: T): T => {
  const nonObjectProperties = _(object).omitBy(_.isObject).value()

  const fixed = _(object)
    .pickBy(_.isObject) // filter to only objects
    .mapValues(removeNilFields) // call only for values as objects
    .assign(nonObjectProperties) // save back fields that are not objects
    .omitBy(_.isNil) // remove null and undefined from this object
    .value()

  return fixed as unknown as T
};

// MARK: Unwrap Eithers

export function assertRight<Right>(description: string, either: E.Either<any, Right>): Right {
  if (E.isLeft(either)) {
    throw Error(`Bad (left) ${description}: ${util.inspect(either.left, true, null)}`)
  } else {
    return either.right
  }
}

export const makeNullable = <T extends t.Any>(type: T) => t.union([type, t.null])

// --- Codable wrapper class

export type Codable<Type, TypeRaw> = {
  value: Type
  type: t.Type<Type, TypeRaw>
}

// --- Named types

export function namedType<
  Models extends Record<string, t.Type<any>>,
  Name extends string & keyof Models
>(models: Models, name: Name): t.Type<
  typeof models[Name]['_A'],
  typeof models[Name]['_O']
> {
  // FIXME: !! shouldn't be required
  const type = models[name]!!

  return new t.Type<typeof type._A, typeof type._O, typeof type._I>(
    name,
    type.is,
    type.validate,
    type.encode
  )
}