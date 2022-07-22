import * as t from 'io-ts'
import * as A from 'fp-ts/Array'
import * as O from 'fp-ts/Option'
import * as E from 'fp-ts/Either'

import { pipe } from 'fp-ts/function'

import type { RESTResource } from "./RESTResource"

export namespace VerdadRESTAPI {

    export type MethodCallback = <
        // Request Models
        Path, PathRaw extends RESTResource.StringRaw<Path>,
        Query, QueryRaw extends RESTResource.StringRaw<Query>,
        Header, HeaderRaw extends RESTResource.StringRaw<Header>,
        Request, RequestRaw,
        // Response Models
        SuccessResponseStatusCodes extends number, SuccessResponse, SuccessResponseRaw,
        ErrorResponseStatusCodes extends number, ErrorResponse, ErrorResponseRaw,
        >(
        method: RESTResource.Method.Definition<
            // Request Models
            Path, PathRaw,
            Query, QueryRaw,
            Header, HeaderRaw,
            Request, RequestRaw,
            // Response Models
            SuccessResponseStatusCodes, SuccessResponse, SuccessResponseRaw,
            ErrorResponseStatusCodes, ErrorResponse, ErrorResponseRaw
        >
    ) => void

    export type AnyMethod = RESTResource.Method.Definition<any, any, any, any, any, any, any, any, any, any, any, any, any, any>
    export type Resources = Record<string, Resource<
        AnyMethod | undefined,
        AnyMethod | undefined,
        AnyMethod | undefined,
        AnyMethod | undefined,
        AnyMethod | undefined
    >>
    export type Resource<
        GET extends AnyMethod | undefined,
        POST extends AnyMethod | undefined,
        PUT extends AnyMethod | undefined,
        PATCH extends AnyMethod | undefined,
        DELETE extends AnyMethod | undefined
        > = {
            get: GET,
            post: POST,
            put: PUT,
            patch: PATCH,
            delete: DELETE,
        }
    export type Servers = Record<string, string> // FIXME: Value should be URL type
    export type Definition<
        R extends Resources,
        S extends Servers
        > = {
            name: string,
            servers: S
            forEachMethod: (callback: MethodCallback) => void,
            resources: R
        }

    export type Context = {
        name: string,
        callback?: MethodCallback
    }

    export type Builder<R extends Resources> = (context: Context) => R

    export type MethodContext<Path> = Context & {
        path: RESTResource.Path.Qualified<Path>,
        name: RESTResource.Method.Name,
    }
    export type MethodBuilder<Path, Method> = (context: MethodContext<Path>) => Method

    export function api<
        R extends Resources,
        S extends Servers,
    >(input: {
        name: string,
        servers: S,
        builder: Builder<R>
    }): Definition<R, S> {
        return {
            name: input.name, 
            servers: input.servers,
            resources: input.builder({ name: input.name }),
            forEachMethod: (callback) => input.builder({ name: input.name, callback }),
        }
    }

    export function resource<
        Path,
        GET extends AnyMethod | undefined,
        POST extends AnyMethod | undefined,
        PUT extends AnyMethod | undefined,
        PATCH extends AnyMethod | undefined,
        DELETE extends AnyMethod | undefined
    >(
        context: Context,
        path: RESTResource.Path.Collapsable<Path>,
        builders: {
            get: MethodBuilder<Path, GET>,
            post: MethodBuilder<Path, POST>,
            put: MethodBuilder<Path, PUT>,
            patch: MethodBuilder<Path, PATCH>,
            delete: MethodBuilder<Path, DELETE>,
        },
    ): Resource<GET, POST, PUT, PATCH, DELETE> {
        const qualifiedPath = pipe(path, A.filterMap(O.fromNullable))
        const partialContext = { ...context, path: qualifiedPath }
        return {
            get: builders.get({ ...partialContext, name: 'get' }),
            post: builders.post({ ...partialContext, name: 'post' }),
            put: builders.put({ ...partialContext, name: 'put' }),
            patch: builders.patch({ ...partialContext, name: 'patch' }),
            delete: builders.delete({ ...partialContext, name: 'delete' }),
        }
    }

    export function method<
        // Request Models
        Path, PathRaw extends RESTResource.StringRaw<Path>,
        Query, QueryRaw extends RESTResource.StringRaw<Query>,
        Header, HeaderRaw extends RESTResource.StringRaw<Header>,
        Request, RequestRaw,
        // Response Models
        SuccessResponseStatusCodes extends number, SuccessResponse, SuccessResponseRaw,
        ErrorResponseStatusCodes extends number, ErrorResponse, ErrorResponseRaw,
        >(
            context: MethodContext<Path>,
            methodDetails: Omit<RESTResource.Method.Definition<
                // Request Models
                Path, PathRaw,
                Query, QueryRaw,
                Header, HeaderRaw,
                Request, RequestRaw,
                // Response Models
                SuccessResponseStatusCodes, SuccessResponse, SuccessResponseRaw,
                ErrorResponseStatusCodes, ErrorResponse, ErrorResponseRaw
            >, 'path' | 'name'>
        ): RESTResource.Method.Definition<
            // Request Models
            Path, PathRaw,
            Query, QueryRaw,
            Header, HeaderRaw,
            Request, RequestRaw,
            // Response Models
            SuccessResponseStatusCodes, SuccessResponse, SuccessResponseRaw,
            ErrorResponseStatusCodes, ErrorResponse, ErrorResponseRaw
        > {

        const method: RESTResource.Method.Definition<
            // Request Models
            Path, PathRaw,
            Query, QueryRaw,
            Header, HeaderRaw,
            Request, RequestRaw,
            // Response Models
            SuccessResponseStatusCodes, SuccessResponse, SuccessResponseRaw,
            ErrorResponseStatusCodes, ErrorResponse, ErrorResponseRaw
        > = {
            ...context,
            ...methodDetails
        }

        if (context.callback !== undefined) {
            context.callback(method)
        }

        return method
    }

    export function getServersType<
        S extends Servers
    >(api: Definition<any, S>): t.KeyofType<S> {
        return t.keyof(api.servers)
    }

    export function decodeServer<
        S extends Servers
    >(api: Definition<any, S>, server: string): keyof S {
        const decodedServer = getServersType(api).decode(server)

        if (E.isLeft(decodedServer)) {
            throw Error(`API server was not one of the expected values: ${server} (${decodedServer.left})`)
        }
        return decodedServer.right
    }
}