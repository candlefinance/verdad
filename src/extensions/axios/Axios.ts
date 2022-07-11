import * as E from 'fp-ts/Either'
import type * as t from 'io-ts'

import axios, { AxiosBasicCredentials, AxiosRequestConfig } from "axios";

import { Logger, wrappedIfSome } from "../../core/Utilities";
import type { VerdadRESTAPI } from "../../core/RESTAPI";
import { RESTResource } from "../../core/RESTResource";

export namespace VerdadAxios {

  type VerdadAxiosErrorTemplate<Label extends string, Data extends Record<string, any>> = {
    label: Label,
  } & Data

  export type SuccessDetails<
    SuccessResponse,
    SuccessResponseStatusCodes,
    > = {
      statusCode: SuccessResponseStatusCodes
      successResponse: SuccessResponse
    }

  export type ErrorDetails<
    ErrorResponse,
    ErrorResponseStatusCodes,
    SuccessResponseStatusCodes
    > = VerdadAxiosErrorTemplate<
      'No status code returned',
      {
        response: unknown
      }
    > | VerdadAxiosErrorTemplate<
      'Unexpected success status code returned',
      {
        response: unknown,
        statusCode: number
      }
    > | VerdadAxiosErrorTemplate<
      'Unexpected error status code returned',
      {
        response: unknown,
        statusCode: number
      }
    > | VerdadAxiosErrorTemplate<
      'Could not decode error response',
      {
        response: unknown,
        statusCode: ErrorResponseStatusCodes,
        decodingErrors: t.Errors
      }
    > | VerdadAxiosErrorTemplate<
      'Could not decode success response',
      {
        response: unknown,
        statusCode: SuccessResponseStatusCodes,
        decodingErrors: t.Errors
      }
    > | VerdadAxiosErrorTemplate<
      'Error response returned',
      {
        statusCode: ErrorResponseStatusCodes,
        errorResponse: ErrorResponse
      }
    > | VerdadAxiosErrorTemplate<
      'Request could not be made',
      {
        requestConfig: AxiosRequestConfig<unknown>
      }
    > | VerdadAxiosErrorTemplate<
      'No response received',
      {
        request: unknown
      }
    >

  export type Call<S, Path, Query, Header, Request> = RESTResource.Method.Call<Path, Query, Header, Request> & {
    server: keyof S,
    basicAuth?: AxiosBasicCredentials,
    httpsAgent?: AxiosRequestConfig['httpsAgent']
  }

  export class RESTAPI<
    R extends VerdadRESTAPI.Resources,
    S extends VerdadRESTAPI.Servers,
    > {
    logger: Logger<any, any> | undefined
    api: VerdadRESTAPI.Definition<R, S>

    constructor(input: {
      logger?: Logger<any, any>,
      api: VerdadRESTAPI.Definition<R, S>,
    }) {
      this.logger = input.logger
      this.api = input.api
    }

    // FIXME: Enforce that method is on this.api
    async callMethod<
      // Request Models
      Path,
      PathRaw extends RESTResource.StringRaw<Path>,
      Query,
      QueryRaw extends RESTResource.StringRaw<Query>,
      Header,
      HeaderRaw extends RESTResource.StringRaw<Header>,
      Request,
      RequestRaw,
      // Response Models
      SuccessResponseStatusCodes extends number,
      SuccessResponse,
      SuccessResponseRaw,
      ErrorResponseStatusCodes extends number,
      ErrorResponse,
      ErrorResponseRaw
    >(
      method: RESTResource.Method.Definition<
        // Request Models
        Path,
        PathRaw,
        Query,
        QueryRaw,
        Header,
        HeaderRaw,
        Request,
        RequestRaw,
        // Response Models
        SuccessResponseStatusCodes,
        SuccessResponse,
        SuccessResponseRaw,
        ErrorResponseStatusCodes,
        ErrorResponse,
        ErrorResponseRaw
      >,
      call: Call<S, Path, Query, Header, Request>
    ): Promise<E.Either<
      ErrorDetails<ErrorResponse, ErrorResponseStatusCodes, SuccessResponseStatusCodes>,
      SuccessDetails<SuccessResponse, SuccessResponseStatusCodes>
    >> {
      const baseURL = this.api.servers[call.server]
      const url = baseURL + RESTResource.Path.stringify(method.path, {
        parameters: call.pathParameters,
        encoder: method.pathParametersType.runtimeType,
      })

      function isExpectedStatusCode<ExpectedStatusCodes extends number>(
        statusCode: number,
        expectedStatusCodes: ExpectedStatusCodes[]
      ): statusCode is ExpectedStatusCodes {
        const expectedStatusCodeNumbers: number[] = expectedStatusCodes
        return expectedStatusCodeNumbers.includes(statusCode)
      }

      try {
        this.logger?.log('debug', {}, {
          'category': 'Other',
          'event': 'Generic',
          metadata: {
            'message': `[Verdad/Axios] calling ${method.name.toUpperCase()} ${url}: ${JSON.stringify(method.requestBodyType.runtimeType.encode(call.body))}`
          }
        })

        const response = await axios({
          method: method.name.toUpperCase(),
          url: url,
          data: method.requestBodyType.runtimeType.encode(call.body),
          headers: method.headerParametersType.runtimeType.encode(call.headerParameters),
          params: method.queryParametersType.runtimeType.encode(call.queryParameters),
          httpsAgent: call.httpsAgent,
          ...wrappedIfSome('auth', call.basicAuth),
        })


        if (!isExpectedStatusCode(response.status, method.successResponse.statusCodes)) {
          return E.left({
            label: 'Unexpected success status code returned',
            statusCode: response.status,
            response: response.data
          })

        } else {
          const normalizedData = response.data === '' ? null : response.data
          const successResponse = method.successResponse.bodyType.runtimeType.decode(normalizedData);

          if (E.isLeft(successResponse)) {
            const decodingErrors = successResponse.left

            // throw new Error(`Verdad (via Axios) recieved ${response.status} success response but with unexpected body. Decoding error: ${JSON.stringify(decodedSuccess.left)}`)
            return E.left({
              label: 'Could not decode success response',
              statusCode: response.status, 
              response: response.data, 
              decodingErrors,
            })

          } else {
            this.logger?.log('debug', {}, {
              'category': 'Other',
              'event': 'Generic',
              metadata: {
                'message': `[Verdad/Axios] received success response to ${url}: ${successResponse.right}`
              }
            })

            return E.right({
              statusCode: response.status, 
              successResponse: successResponse.right
            }) 
          }
        }

      } catch (error) {
        if (!axios.isAxiosError(error)) {
          throw error

        } else {
          const response = error.response

          if (error.request === undefined) {
            // throw new Error(`Verdad could not create Axios request: ${error.message}`)
            return E.left({
              label: 'Request could not be made',
              requestConfig: error.config,
            })
          } else if (response === undefined) {
            // throw new Error(`Verdad (via Axios) recieved no response`)
            return E.left({
              label: 'No response received',
              request: error.request,
            })
          } else if (!isExpectedStatusCode(response.status, method.errorResponse.statusCodes)) {
            return E.left({
              label: 'Unexpected error status code returned',
              statusCode: response.status,
              response: response.data
            })
          } else {
            const errorResponse = method.errorResponse.bodyType.runtimeType.decode(response.data);

            if (E.isLeft(errorResponse)) {
              return E.left({
                label: 'Could not decode error response',
                statusCode: response.status, 
                response: response.data,
                decodingErrors: errorResponse.left
              })

            } else {
              return E.left({
                label: 'Error response returned',
                statusCode: response.status,
                errorResponse: errorResponse.right,
              })
            }
          }
        }
      }
    }
  }
}