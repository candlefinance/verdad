import _ from 'lodash'

import type * as t from 'io-ts'
import * as E from 'fp-ts/Either'

import {
  BaseQueryFn,
  createApi,
  FetchArgs,
  fetchBaseQuery,
  FetchBaseQueryError,
  FetchBaseQueryMeta,
  MutationDefinition,
} from '@reduxjs/toolkit/query/react';

import { RESTResource } from '../../core/RESTResource';
import type { VerdadRESTAPI } from '../../core/RESTAPI';
import type { Logger } from '../../core/Utilities';

type VerdadRTKErrorTemplate<Label extends string, Data extends Record<string, any>> = {
  status: 'CUSTOM_ERROR',
  error: Label,
  data: Data
}

type VerdadRTKError<ErrorResponse> = VerdadRTKErrorTemplate<
  'No status code returned',
  { response: unknown }
> | VerdadRTKErrorTemplate<
  'Unexpected status code returned',
  { response: unknown, statusCode: number }
> | VerdadRTKErrorTemplate<
  'Could not decode error response',
  { response: unknown, statusCode: number, decodingErrors: t.Errors }
> | VerdadRTKErrorTemplate<
  'Could not decode success response',
  { response: unknown, statusCode: number, decodingErrors: t.Errors }
> | VerdadRTKErrorTemplate<
  'Error response returned',
  { errorResponse: ErrorResponse }
>

export function makeRTKAPI<
  R extends VerdadRESTAPI.Resources,
  S extends VerdadRESTAPI.Servers,
  ReducerPath extends string
>(input: {
  logger?: Logger<any, any>,
  api: VerdadRESTAPI.Definition<R, S>,
  reducerPath: ReducerPath,
  server: keyof S
}) {
  return createApi({
    reducerPath: input.reducerPath,
    baseQuery: fetchBaseQuery({
      baseUrl: input.api.servers[input.server],
    }),
    endpoints: builder => {

      function makeRTKMutation<
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
        >
      ) {
        return builder.mutation<
          SuccessResponse,
          RESTResource.Method.Call<Path, Query, Header, Request>
        >({
          query: call => {

            const body = method.requestBodyType.encode(call.body)
            const path = RESTResource.Path.stringify(method.path, {
              parameters: call.pathParameters,
              encoder: method.pathParametersType,
            })

            input.logger?.log('debug', {}, {
              'category': 'Other',
              'event': 'Generic',
              metadata: {
                'message': `MAKING CALL TO ${path}`
              }
            })
            return ({
              url: path,
              // FIXME: Not sure if necessary to upper-case it
              method: method.name.toUpperCase(),
              params: method.queryParametersType.encode(call.queryParameters),
              headers: method.headerParametersType.encode(call.headerParameters),

              /** IMPORTANT NOTE: According to the docs, `null` is the proper value to not pass a body.
               * In testing, `null` crashes, but `undefined` works as expected.
               */
              body: body === null ? undefined : body,

              // IMPORTANT NOTE: This allows us to handle all responses (not just 2xx ones) in transformResponse below.
              validateStatus: () => true,
            })
          },
          transformResponse: (response, meta) => {
            const fail = (error: VerdadRTKError<ErrorResponse>) => Promise.reject(error) 

            const expectedSuccessStatusCodes: number[] = method.successResponse.statusCodes
            const expectedErrorStatusCodes: number[] = method.errorResponse.statusCodes

            const statusCode = meta?.response?.status

            if (statusCode === undefined) {
              return fail({
                status: 'CUSTOM_ERROR',
                error: 'No status code returned',
                data: { response },
              })

            } else if (!expectedSuccessStatusCodes.includes(statusCode)) {

              if (!expectedErrorStatusCodes.includes(statusCode)) {
                return fail({
                  status: 'CUSTOM_ERROR',
                  data: { statusCode, response },
                  error: 'Unexpected status code returned',
                })
              } else {
                const errorResponse = method.errorResponse.bodyType.decode(response);

                if (E.isLeft(errorResponse)) {
                  const decodingErrors = errorResponse.left

                  return fail({
                    status: 'CUSTOM_ERROR',
                    data: { statusCode, response, decodingErrors },
                    error: 'Could not decode error response',
                  })

                } else {
                  return fail({
                    status: 'CUSTOM_ERROR',
                    data: { errorResponse: errorResponse.right },
                    error: 'Error response returned',
                  })
                }
              }

            } else {
              const successResponse = method.successResponse.bodyType.decode(response);

              if (E.isLeft(successResponse)) {
                const decodingErrors = successResponse.left

                return fail({
                  status: 'CUSTOM_ERROR',
                  data: { statusCode, response, decodingErrors },
                  error: 'Could not decode success response',
                })
                
              } else {
                return successResponse.right
              }
            }
          },
        })
      }

      /** IMPORTANT NOTE: Only for use in type expressions. 
       * Do not use this class in any executable code. 
       * Instead, call makeRTKMutation directly. */
      class RTKMethodTransformer<Method extends VerdadRESTAPI.AnyMethod> {
        transformMethod() {
          const method: any = ''

          return makeRTKMutation<
            RESTResource.Method.Path<Method>,
            RESTResource.Method.PathRaw<Method>,
            RESTResource.Method.Query<Method>,
            RESTResource.Method.QueryRaw<Method>,
            RESTResource.Method.Header<Method>,
            RESTResource.Method.HeaderRaw<Method>,
            RESTResource.Method.Request<Method>,
            RESTResource.Method.RequestRaw<Method>,
            RESTResource.Method.SuccessResponseStatusCodes<Method>,
            RESTResource.Method.SuccessResponse<Method>,
            RESTResource.Method.SuccessResponseRaw<Method>,
            RESTResource.Method.ErrorResponseStatusCodes<Method>,
            RESTResource.Method.ErrorResponse<Method>,
            RESTResource.Method.ErrorResponseRaw<Method>
          >(method)
        }
      }

      type RTKMethod<Method extends VerdadRESTAPI.AnyMethod | undefined> = Method extends VerdadRESTAPI.AnyMethod ? ReturnType<RTKMethodTransformer<Method>["transformMethod"]> : never
      type ResourceNames = string & keyof R

      // FIXME: Remove undefined methods from RTK API altogether
      type MethodResources<MethodName extends RESTResource.Method.Name> = {
        [ResourceName in ResourceNames as `${ResourceName}${Uppercase<MethodName>}`]:
        RTKMethod<R[ResourceName][MethodName]>
      } 

      type RTKEndpoints = MethodResources<'get'>
        & MethodResources<'post'>
        & MethodResources<'put'>
        & MethodResources<'patch'>
        & MethodResources<'delete'>

      // IMPORTANT NOTE: The output of the following code must exactly match the 'RTKEndpoints' type signature.
      // It is NOT being checked by the compiler for type accuracy, due to limitations of type inference for higher-order collection functions.
      const resourceMutations = _(input.api.resources as VerdadRESTAPI.Resources)
        .map((methods, resourceName) => {
          return _(methods)
            .mapKeys((_, methodName) => `${resourceName}${methodName.toUpperCase()}`)
            .mapValues((method) => method === undefined ? undefined : makeRTKMutation(method))
            .omitBy(_.isUndefined)
            .value()
        })
        .value()

        // FIXME: This doesn't actually include undefined values, but the .omitBy call above doesn't reflect in the type engine
        var mutations: Record<string, MutationDefinition<
        RESTResource.Method.Call<any, any, any, any>,
        BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError, {}, FetchBaseQueryMeta>,
        never,
        any,
        ReducerPath
      > | undefined> = {}
      for (const resource of resourceMutations) {
        for (const [methodName, method] of Object.entries(resource)) {
          mutations[methodName] = method
        }
      }
      
      return mutations as RTKEndpoints
    },
  });
}