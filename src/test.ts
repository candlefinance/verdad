// This file contains the sample code used in README.md
// Its purpose is to verify that the code is compilable

const PlaylistModel = t.type({ /* ... */ })
function retrievePlaylists(_: any, _2: any, _3: any): t.TypeOf<typeof PlaylistModel>[] {
  return []
}
function displayToUser(_: any, _2?: any) { }

// ------- STEP 1

import * as t from 'io-ts'

import { StatusCodes } from "http-status-codes";

import { VerdadRESTAPI } from "./core/RESTAPI";
import { NumberFromString } from 'io-ts-types';

export const musicAPI = VerdadRESTAPI.api({
  name: 'my New Music Startup',
  servers: {
    prod: 'https://api.music.com',
    test: 'https://test-api.music.com',
  },
  builder: (ctx) => ({
    playlists: VerdadRESTAPI.resource(ctx, ['users', { parameter: 'userID' }, 'playlists'], {

      get: (ctx) => VerdadRESTAPI.method(ctx, {
        pathParametersType: t.type({ userID: t.string }),
        queryParametersType: t.partial({ pageNumber: NumberFromString }),
        headerParametersType: t.type({ 'authorization-token': t.string, }),
        requestBodyType: t.null,
        successResponse: {
          statusCodes: [
            StatusCodes.OK as const
          ],
          bodyType: t.array(PlaylistModel)
        },
        errorResponse: {
          statusCodes: [
            StatusCodes.UNAUTHORIZED as const,
            StatusCodes.BAD_REQUEST as const,
            StatusCodes.INTERNAL_SERVER_ERROR as const,
          ],
          bodyType: t.type({ errorDetails: t.string }),
        }
      }),

      post: () => undefined,
      delete: () => undefined,
      patch: () => undefined,
      put: () => undefined,
    }),

    // albums: ...,
  })
})

// ------- STEP 2A

import type { AWS } from '@serverless/typescript';
import { VerdadCloudFormation } from './extensions/aws/CloudFormation';

const serverlessConfig: AWS = {
  service: 'music-api',
  provider: { name: 'aws' },
  functions: VerdadCloudFormation.makeServerlessFunctions(musicAPI),
};

module.exports = serverlessConfig;

// ------- STEP 2B

import * as E from 'fp-ts/Either'
import { implement, LambdaRuntimeError } from './extensions/aws/Lambda';

export const { verdadMain } = implement(
  musicAPI.resources.playlists.get,
  async (input) => {
    const playlists = retrievePlaylists(
      input.pathParameters.userID,
      input.headerParameters['authorization-token'],
      input.queryParameters.pageNumber,
    )

    return E.right({
      statusCode: StatusCodes.OK,
      body: {
        value: playlists,
        type: t.array(PlaylistModel)
      }
    })
  },
  (error: LambdaRuntimeError) => {
    switch (error.kind) {
      case 'invalid_request_schema':
      case 'non_json_request_body':
        return {
          statusCode: StatusCodes.BAD_REQUEST,
          body: {
            value: { errorDetails: JSON.stringify(error.details) },
            type: t.type({ errorDetails: t.string }),
          }
        }
      case 'unexpected_runtime_error':
        return {
          statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
          body: {
            value: { errorDetails: 'Details hidden for security' },
            type: t.type({ errorDetails: t.string }),
          }
        }
    }
  }
)

// ------- STEP 3

import { VerdadAxios } from './extensions/axios/Axios';

async function getPlaylists(userID: string, authToken: string) {

  const musicAPIAxios = new VerdadAxios.RESTAPI({
    api: musicAPI
  })

  const playlists = await musicAPIAxios.callMethod(musicAPI.resources.playlists.get, {
    server: 'prod',
    pathParameters: { userID },
    queryParameters: {},
    headerParameters: {
      'authorization-token': authToken
    },
    body: null,
  })

  if (E.isRight(playlists)) {
    displayToUser(playlists.right.successResponse)

  } else {
    const error = playlists.left
    switch (error.label) {
      case 'Error response returned':
        displayToUser(error.statusCode, error.errorResponse)
        break;

      case 'Could not decode error response':
      case 'Unexpected error status code returned':
      case 'Could not decode success response':
      case 'Unexpected success status code returned':
        displayToUser(error.statusCode, error.response)
        break;

      case 'No response received':
      case 'No status code returned':
      case 'Request could not be made':
        displayToUser('Check your Internet connection and try again.')
        break;
    }
  }
}

// -------

getPlaylists('', '')