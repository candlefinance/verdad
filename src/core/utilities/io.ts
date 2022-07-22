import * as t from 'io-ts'
import * as A from 'fp-ts/Array'
import * as E from 'fp-ts/Either'

import { pipe, flow } from 'fp-ts/function';
import { BooleanFromString, NumberFromString } from 'io-ts-types';

import { mapKeys, toLowerCase } from './fp';

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
  return pipe(props,
    mapKeys(toLowerCase) as unknown as (p: Props) => CaseInsensitiveProps<Props>,
    typeStaticBuilder,
    (lowercasedType) => new typeConstructor(
      `CaseInsensitive<${lowercasedType.name}>`,
      (unknown): unknown is t.TypeOf<Type> => lowercasedType.is(unknown),
      (unknown, context) => pipe(
        t.record(t.string, t.unknown).validate(unknown, context),
        // NOTE: Without the "in props" check, we might create (lowercased) keys NOT specified by props,
        // but which may be specified by other types used in an intersection.
        // If two sides of an intersection modify/define a key, io-ts doesn't know which value to choose.
        E.map(mapKeys((key: string) => pipe(
            key.toLowerCase(),
            (lowercasedKey) => lowercasedKey in lowercasedType.props ? lowercasedKey : key
          ))
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
  Props extends t.Props
>(
  props: Props
): t.TypeC<CaseInsensitiveProps<Props>> {
  return caseInsensitive(t.InterfaceType, t.type, props)
}

export function caseInsensitivePartial<
  Props extends t.Props
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
  
// --- Nullable types

export const makeNullable = <T extends t.Any>(type: T) => t.union([type, t.null])
