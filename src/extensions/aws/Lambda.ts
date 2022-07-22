import safeJsonStringify from 'safe-json-stringify';

import * as t from 'io-ts'
import * as E from 'fp-ts/Either'
import * as TE from 'fp-ts/TaskEither'

import { flow, pipe } from 'fp-ts/function';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import type { RESTResource } from "../../core/RESTResource";

import { lazy } from '../../core/utilities/fp';

// Error logging protocols:
// Any "user" error: cleaned and returned in response to client
// Any "programming" error: generic 500 response to client
// - specific known error: clean and log before returning
// - system-thrown error or not an error: pray and log before returning

export type LambdaRuntimeError = {
  kind: 'non_json_request_body',
  details: unknown 
} | {
  kind: 'invalid_request_schema',
  details: t.Errors
} | {
  kind: 'unexpected_runtime_error'
}
export type LambdaErrorHandler<StatusCodes extends number, ErrorResponse, ErrorResponseRaw> = (runtimeError: LambdaRuntimeError) => RESTResource.Method.Response<StatusCodes, ErrorResponse, ErrorResponseRaw>

function awsResponse<StatusCode extends number, Body, BodyRaw>(response: RESTResource.Method.Response<StatusCode, Body, BodyRaw>): APIGatewayProxyResult {
  const encodedBody = response.body.type.encode(response.body.value)

  return {
    statusCode: response.statusCode,
    body: encodedBody === null ? "" : JSON.stringify(encodedBody)
  }
}

export function implement<
  // Request Models
  Path, Query, Header, Request,
  // Response Models
  SuccessResponseStatusCodes extends number, SuccessResponse, SuccessResponseRaw,
  ErrorResponseStatusCodes extends number, ErrorResponse, ErrorResponseRaw,
  >(
    method: RESTResource.Method.Definition<
      // Request Models
      Path, any,
      Query, any,
      Header, any,
      Request, any,
      // Response Models
      SuccessResponseStatusCodes, SuccessResponse, any,
      ErrorResponseStatusCodes, ErrorResponse, any
    >,
    implementation: (input: {
      apiGatewayStage: string,

      // Request
      pathParameters: Path,
      queryParameters: Query,
      // FIXME: Add back API Gateway Header after getting it to show up in localstack
      headerParameters: Header,
      requestBody: Request,

      // Response
    }) => Promise<E.Either<
      RESTResource.Method.Response<ErrorResponseStatusCodes, ErrorResponse, ErrorResponseRaw>,
      RESTResource.Method.Response<SuccessResponseStatusCodes, SuccessResponse, SuccessResponseRaw>
    >>,
    errorHandler: LambdaErrorHandler<ErrorResponseStatusCodes, ErrorResponse, ErrorResponseRaw>
  ) {

  function handleUnexpectedError(error: unknown): APIGatewayProxyResult {
    if (error instanceof Error) {
      // FIXME: Use fp-ts to pipe typed errors all the way up,
      // so only privacy issue is with system-thrown errors
      console.log(`[PRIVACY WARNING] Caught unexpected error: ${error.name} (${error.message}) ${error.stack ?? "[no stack]"})`)
    } else if (typeof error === 'object') {
      if (error === null) {
        console.log(`Caught unexpected null error`)
      } else {
        console.log(`[PRIVACY WARNING] Caught unexpected non-error: ${safeJsonStringify(error)}`)
      }
    } else {
      console.log(`[PRIVACY WARNING] Caught unexpected non-error: ${error}`)
    }

    // FIXME: Define this raw to eliminate possibility of throwing error inside catch?
    return awsResponse(errorHandler({
      kind: 'unexpected_runtime_error'
    }))
  }

  const verdadMain = async (apiGatewayEvent: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      const Wrapper = t.type({
        requestBody: method.requestBodyType,
        pathParameters: method.pathParametersType,
        queryParameters: method.queryParametersType,
        headerParameters: method.headerParametersType
      })

      return pipe(
        apiGatewayEvent.body,
        E.tryCatchK(
          (rawBody): unknown | null => {
            if (rawBody === null || rawBody === '') {
              return null
            } else {
              return JSON.parse(rawBody)
            }
          },
          (parsingError) => errorHandler({
            kind: 'non_json_request_body',
            details: parsingError
          })
        ),
        E.map((requestBodyObject) => ({
          requestBody: requestBodyObject,
          pathParameters: apiGatewayEvent.pathParameters ?? {},
          queryParameters: apiGatewayEvent.queryStringParameters ?? {},
          headerParameters: apiGatewayEvent.headers
        })),
        E.chainW(flow(
          Wrapper.decode,
          E.mapLeft((decodingErrors) => errorHandler({
            kind: 'invalid_request_schema',
            details: decodingErrors
          }))
        )),
        E.mapLeft(<
          ErrorResponse,
          ErrorResponseRaw,
          StatusCode extends number
        >(errorResponse: RESTResource.Method.Response<StatusCode, ErrorResponse, ErrorResponseRaw>) => awsResponse(
          errorResponse,
        )),
        TE.fromEither,
        TE.chainW((decodedMethodInput) => pipe(
          TE.tryCatch(
            lazy(implementation({
              apiGatewayStage: apiGatewayEvent.requestContext.stage,
              ...decodedMethodInput,
            })),
            handleUnexpectedError
          ),
          TE.map(
            E.bimap(
              (errorResponse: RESTResource.Method.Response<ErrorResponseStatusCodes, ErrorResponse, ErrorResponseRaw>) => awsResponse(
                errorResponse,
              ),
              (successResponse: RESTResource.Method.Response<SuccessResponseStatusCodes, SuccessResponse, SuccessResponseRaw>) => awsResponse(
                successResponse,
              )
            )
          ),
        )),
        TE.map(E.toUnion),
        TE.toUnion
      )()
    } catch (error) {
      return handleUnexpectedError(error)
    }
  }

  return { verdadMain }
}