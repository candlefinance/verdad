import * as t from "io-ts";

import { pipe } from "fp-ts/lib/function";
import { Interval, Duration, DateTime, ToISOTimeOptions, DateTimeOptions } from "luxon";
import { chain } from "fp-ts/lib/Either";

export namespace ISO {

  export interface ISOEncodable {
    toISO(opts?: ToISOTimeOptions): string;
  }
  
  export type ISODecodable<Type extends ISOEncodable> = (text: string, opts?: DateTimeOptions) => Type

  export class ISOType<Type extends ISOEncodable> extends t.Type<Type, string> {
    readonly _tag = `Verdad.ISOType`

    constructor(name: string, isType: t.Is<Type>, fromISO: ISODecodable<Type>) {
      super(
        name, // FIXME: Why do we need to specify this as a string
        isType,
        (iso, context) => pipe(
          t.string.validate(iso, context),
          chain((isoString) => t.success(fromISO(isoString)))
        ),
        luxonValue => luxonValue.toISO()
      )
    }
  }

  /** An ISO country code.
   * https://www.iso.org/iso-3166-country-codes.html */
  const CountryCode = t.string
  // FIXME: Require 3-letter count or even better, list

  /** An ISO currency code. 
     * ttps://www.iso.org/iso-4217-currency-codes.html */
  const CurrencyCode = t.string
  // FIXME: Require 3-letter count or even better, list

  const TimeInterval = new ISOType('ISOTimeInterval', Interval.isInterval, Interval.fromISO)
  const TimeDuration = new ISOType('ISOTimeDuration', Duration.isDuration, Duration.fromISO)
  const CombinedDateTime = new ISOType('ISOCombinedDateTime', DateTime.isDateTime, DateTime.fromISO)

  export const runtimeTypes = {
    CountryCode,
    CurrencyCode,
    TimeInterval,
    TimeDuration,
    CombinedDateTime,
  }

  export type Compiletime<Name extends keyof typeof runtimeTypes> = t.TypeOf<typeof runtimeTypes[Name]>
}