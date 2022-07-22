import * as util from 'util'
import * as A from 'fp-ts/Array'
import * as R from 'fp-ts/Record'
import * as E from 'fp-ts/Either'
import * as O from 'fp-ts/Option'
import * as S from 'fp-ts/Separated'

import { flow, identity, pipe } from 'fp-ts/function';

export const mapKeysWithValue = <K extends string, I extends string, A>(
  f: (k: K, a: A) => I
): ((fa: Record<K, A>) => Record<I, A>) => flow(
  R.toEntries,
  A.map(([k, a]): [I, A] => [f(k, a), a]),
  R.fromEntries,
)

export const mapKeys: <K extends string, I extends string, A>(
  f: (k: K) => I
) => (fa: Record<K, A>) => Record<I, A> = mapKeysWithValue

export const join = <A extends string>(
  separator: string
): ((fa: Array<A>) => string) => (fa) => fa.join(separator)

export const toLowerCase = <S extends string>(s: S): Lowercase<S> => s.toLowerCase() as Lowercase<S>

export const wrappedIfSome = <Key extends string, Value>(key: Key, value: Value): { [K in Key]: NonNullable<Value> } | {} => pipe(
  value,
  E.fromNullable({}),
  E.map((nonNullableValue) => ({ [key]: nonNullableValue })),
  E.toUnion
)

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

  if (pipe(collection,
    A.every((element) => propertyAccessor(element) === firstProperty))
  ) {
    return firstProperty
  } else {
    throw Error("Not all properties in this array are equal")
  }
}

export const recursiveAutoCompact = <T extends object>(object: T): T => {
  return pipe(object as Record<string, unknown>,
    R.partition((value): value is object => typeof value === 'object'),
    S.map(R.map(recursiveAutoCompact)),
    S.mapLeft(flow(
      R.map(O.fromNullable),
      R.compact
    )),
    // FIXME: Extend Separated to avoid having to use inline closure here
    (s) => R.union({ concat: identity })(s.left)(s.right)
  ) as T
};

export function assertRight<Right>(description: string, either: E.Either<any, Right>): Right {
  if (E.isLeft(either)) {
    throw Error(`Bad (left) ${description}: ${util.inspect(either.left, true, null)}`)
  } else {
    return either.right
  }
}

// TODO: Make .reversed() that's non-mutating
