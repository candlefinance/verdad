import _ from 'lodash'
import type * as t from 'io-ts'

import type { Codable, Runtime } from './Utilities'

export namespace RESTResource {

    export namespace Path {

        type Component<Path> = string | { parameter: keyof Path }
        export type Qualified<Path> = Component<Path>[]
        export type Collapsable<Path> = (Component<Path> | undefined)[]

        export function stringify<Path, PathRaw extends StringRaw<Path>>(
            path: Qualified<Path>,
            substitutions?: { parameters: Path, encoder: Runtime<Path, PathRaw> }
        ): string {
            const pathComponents = _(path).map((component) => {
                if (typeof component === 'string') {
                    return component
                } else if (substitutions !== undefined) {
                    const encodedParameters = substitutions.encoder.encode(substitutions.parameters)

                    // FIXME: Don't use "as" soft-failing cast
                    const parameterName = component.parameter
                    return encodedParameters[parameterName]
                } else {
                    // FIXME: Require only string keys
                    return `{${String(component.parameter)}}`
                }
            })

            return pathComponents.unshift("").join("/")
        }
    }

    export type StringRaw<Type> = { [Property in keyof Type]: string }

    export type Named<Type, TypeRaw> = {
        name: string,
        runtimeType: Runtime<Type, TypeRaw>
    }

    export function namedType<Type extends t.Any>(type: Type) {
        return {
          name: type.name,
          runtimeType: type
        }
      }

    export namespace Method {

        export type Name = 'get' | 'post' | 'put' | 'patch' | 'delete'

        export type Response<StatusCode extends number, Response, ResponseRaw> = {
            statusCode: StatusCode
            body: Codable<Response, ResponseRaw>,
        }

        export type Call<
            Path, Query, Header, Request
            > = {
                pathParameters: Path,
                queryParameters: Query,
                headerParameters: Header,
                body: Request,
            }

        export type Path<Definition> =
            Definition extends RESTResource.Method.Definition<infer T, any, any, any, any, any, any, any, any, any, any, any, any, any> ? T : never;
        export type PathRaw<Definition> =
            Definition extends RESTResource.Method.Definition<any, infer T, any, any, any, any, any, any, any, any, any, any, any, any> ? T : never;
        export type Query<Definition> =
            Definition extends RESTResource.Method.Definition<any, any, infer T, any, any, any, any, any, any, any, any, any, any, any> ? T : never;
        export type QueryRaw<Definition> =
            Definition extends RESTResource.Method.Definition<any, any, any, infer T, any, any, any, any, any, any, any, any, any, any> ? T : never;
        export type Header<Definition> =
            Definition extends RESTResource.Method.Definition<any, any, any, any, infer T, any, any, any, any, any, any, any, any, any> ? T : never;
        export type HeaderRaw<Definition> =
            Definition extends RESTResource.Method.Definition<any, any, any, any, any, infer T, any, any, any, any, any, any, any, any> ? T : never;
        export type Request<Definition> =
            Definition extends RESTResource.Method.Definition<any, any, any, any, any, any, infer T, any, any, any, any, any, any, any> ? T : never;
        export type RequestRaw<Definition> =
            Definition extends RESTResource.Method.Definition<any, any, any, any, any, any, any, infer T, any, any, any, any, any, any> ? T : never;
        export type SuccessResponseStatusCodes<Definition> =
            Definition extends RESTResource.Method.Definition<any, any, any, any, any, any, any, any, infer T, any, any, any, any, any> ? T : never;
        export type SuccessResponse<Definition> =
            Definition extends RESTResource.Method.Definition<any, any, any, any, any, any, any, any, any, infer T, any, any, any, any> ? T : never;
        export type SuccessResponseRaw<Definition> =
            Definition extends RESTResource.Method.Definition<any, any, any, any, any, any, any, any, any, any, infer T, any, any, any> ? T : never;
        export type ErrorResponseStatusCodes<Definition> =
            Definition extends RESTResource.Method.Definition<any, any, any, any, any, any, any, any, any, any, any, infer T, any, any> ? T : never;
        export type ErrorResponse<Definition> =
            Definition extends RESTResource.Method.Definition<any, any, any, any, any, any, any, any, any, any, any, any, infer T, any> ? T : never;
        export type ErrorResponseRaw<Definition> =
            Definition extends RESTResource.Method.Definition<any, any, any, any, any, any, any, any, any, any, any, any, any, infer T> ? T : never;

        export interface Definition<
            // Request Models
            Path, PathRaw extends StringRaw<Path>,
            Query, QueryRaw extends StringRaw<Query>,
            Header, HeaderRaw extends StringRaw<Header>,
            Request, RequestRaw,
            // Response Models
            // FIXME: Status codes are not enforced in implementations
            SuccessResponseStatusCodes extends number, SuccessResponse, SuccessResponseRaw,
            ErrorResponseStatusCodes extends number, ErrorResponse, ErrorResponseRaw,
            > {
                
            path: Path.Qualified<Path>
            name: Name

            // Request Models
            pathParametersType: Named<Path, PathRaw> // FIXME: Enforce that all path params are defined in path
            queryParametersType: Named<Query, QueryRaw>
            headerParametersType: Named<Header, HeaderRaw>
            requestBodyType: Named<Request, RequestRaw>,

            // Response Models
            successResponse: {
                statusCodes: SuccessResponseStatusCodes[],
                bodyType: Named<SuccessResponse, SuccessResponseRaw>
            },
            errorResponse: {
                statusCodes: ErrorResponseStatusCodes[],
                bodyType: Named<ErrorResponse, ErrorResponseRaw>
            },
        }
    }
}