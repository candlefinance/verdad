import * as t from "io-ts";
import * as E from 'fp-ts/Either'

// Excess
// Copied from https://github.com/gcanti/io-ts/issues/322#issuecomment-584658211

// FIXME: Update RESTResource generics to allow adding this on the backside rather than every individual model
// FIXME: Support t.union and t.keyof

const getIsCodec = <T extends t.Any>(tag: string) => (codec: t.Any): codec is T => (codec as any)._tag === tag
const isInterfaceCodec = getIsCodec<t.InterfaceType<t.Props>>('InterfaceType')
const isPartialCodec = getIsCodec<t.PartialType<t.Props>>('PartialType')

const getProps = (codec: t.HasProps): t.Props => {
  switch (codec._tag) {
    case 'RefinementType':
    case 'ReadonlyType':
      return getProps(codec.type)
    case 'InterfaceType':
    case 'StrictType':
    case 'PartialType':
      return codec.props
    case 'IntersectionType':
      return codec.types.reduce<t.Props>((props, type) => Object.assign(props, getProps(type)), {})
  }
}

const getNameFromProps = (props: t.Props): string => Object.keys(props)
  .map((k) => `${k}: ${props[k]?.name}`)
  .join(', ')

const getPartialTypeName = (inner: string): string => `Partial<${inner}>`

const getExcessTypeName = (codec: t.Any): string => {
  if (isInterfaceCodec(codec)) {
    return `{| ${getNameFromProps(codec.props)} |}`
  } if (isPartialCodec(codec)) {
    return getPartialTypeName(`{| ${getNameFromProps(codec.props)} |}`)
  }
  return `Excess<${codec.name}>`
}

const stripKeys = <T = any>(o: T, props: t.Props): E.Either<Array<string>, T> => {
  const keys = Object.getOwnPropertyNames(o)
  const propsKeys = Object.getOwnPropertyNames(props)

  propsKeys.forEach((pk) => {
    const index = keys.indexOf(pk)
    if (index !== -1) {
      keys.splice(index, 1)
    }
  })

  if (keys.length > 0) {
    // FIXME: Figure out how to pass logger in
    // logger.log('warn', {}, {
    //   'category': 'Other',
    //   'event': 'Generic',
    //   metadata: {
    //     'message': `Found excess keys ${keys}`
    //   }
    // })
  }

  return keys.length
    ? E.left(keys)
    : E.right(o)
}

// FIXME: Support an option where excess keys are stripped (on both encode and decode) rather than an error being returned.
export const excess = <C extends t.HasProps>(codec: C, name: string = getExcessTypeName(codec)): ExcessType<C> => {
  const props: t.Props = getProps(codec)
  return new ExcessType<C>(
    name,
    (u): u is C => E.isRight(stripKeys(u, props)) && codec.is(u),
    (u, c) => E.either.chain(
      t.UnknownRecord.validate(u, c),
      () => E.either.chain(
        codec.validate(u, c),
        (a) => E.either.mapLeft(
          stripKeys<C>(a, props),
          (keys) => keys.map((k) => ({
            value: a[k],
            context: c,
            message: `excess key "${k}" found`,
          })),
        ),
      ),
    ),
    // FIXME: The error generated from the left path is very confusing, since it just returns an "encoded" empty object.
    (a) => codec.encode((stripKeys(a, props) as E.Right<any>).right),
    codec,
  )
}

export class ExcessType<C extends t.Any, A = C['_A'], O = C['_O'], I = C['_I']> extends t.Type<A, O, I> {
  public readonly _tag: 'ExcessType' = 'ExcessType'
  public constructor(
    name: string,
    is: ExcessType<C, A, O, I>['is'],
    validate: ExcessType<C, A, O, I>['validate'],
    encode: ExcessType<C, A, O, I>['encode'],
    public readonly type: C,
  ) {
    super(name, is, validate, encode)
  }
}
