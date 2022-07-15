import * as t from "io-ts";

import { BooleanFromString, IntFromString } from "io-ts-types";

import { ISO } from "../../core/ISO";

export namespace AWS {

  const APIGatewayHeader = t.type({

    Accept: t.string, // Ex: */*
    Host: t.string, // Ex: o8fx93qeu8.execute-api.us-east-1.amazonaws.com
    Via: t.string, // Ex: 2.0 f63e36c66fd4764e570cedab637ba3d6.cloudfront.net (CloudFront)
    'User-Agent': t.string, // Ex: curl/7.64.1
  
    'X-Amz-Cf-Id': t.string, // Ex: dn_c0zqTKUb0TE1qDUuvQ8OAM37Q-yRi1_Viuj8TONhqFpn_IFpSaw==
    'X-Amzn-Trace-Id': t.string, // Ex: Root=1-61eb2ef4-436a13dd0df2d8550523f0cb
    'X-Forwarded-For': t.string, // Ex: 187.62.122.34, 130.176.65.144
    'X-Forwarded-Port': IntFromString, // FIXME: Restrict to valid port numbers
    'X-Forwarded-Proto': t.literal('https'),
  
    'CloudFront-Forwarded-Proto': t.literal('https'),
    'CloudFront-Is-Desktop-Viewer': BooleanFromString,
    'CloudFront-Is-Mobile-Viewer': BooleanFromString,
    'CloudFront-Is-SmartTV-Viewer': BooleanFromString,
    'CloudFront-Is-Tablet-Viewer': BooleanFromString,
    'CloudFront-Viewer-Country': ISO.models.CountryCode,
  })

  export const runtimeTypes = {
    Null: t.null,
    Empty: t.type({}),

    APIGatewayHeader
  }

  export function named<Name extends keyof typeof runtimeTypes>(name: Name) {
    return { name: name, runtimeType: runtimeTypes[name] }
  }

  export type Compiletime<Name extends keyof typeof runtimeTypes> = t.TypeOf<typeof runtimeTypes[Name]>
}