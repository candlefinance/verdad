![verdad](https://user-images.githubusercontent.com/2965782/178850715-40efafda-c0fd-4adc-a7d5-35d649b02f7f.png)

# Verdad

Verdad lets you:
- ✅ write your API once, with support for multiple base URLs and fully typed parameters & bodies (using **io-ts**)
- ✅ implement and deploy your API to any infrastructure using built-in or custom extensions
- ✅ call your API from the client with zero duplication and no synchonization headaches

### Step 1
Define your backend API in Verdad:

```typescript
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
      playlists: VerdadRESTAPI.resource(ctx, ['users', { parameter: 'userID'}, 'playlists'], {
  
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
  
        post: ...,
        delete: ...,

        patch: () => undefined,
        put: () => undefined,
      }),
  
      albums: ...,
    })
})
```

### Step 2
Use an extension to deploy this API to your infrastructure of choice:

For example, to deploy to AWS Lambda:

1. Call `VerdadCloudFormation.makeServerlessFunctions()` from your `serverless.ts` file:

```typescript
import type { AWS } from '@serverless/typescript';
import { VerdadCloudFormation } from './extensions/aws/CloudFormation';

const serverlessConfig: AWS = {
  service: 'music-api',
  provider: { name: 'aws' },
  functions: VerdadCloudFormation.makeServerlessFunctions(musicAPI),
};

module.exports = serverlessConfig;
```

2. Implement each of your API methods. `makeServerlessFunctions()` looks for the implementations under `src/resources/<path>/<method>`. For the `users/*/playlists` GET method example above, it would look for an implementation in `src/resources/users/playlists/get.ts`:

```typescript
import * as E from 'fp-ts/Either'
import { implement, LambdaRuntimeError } from 'verdad/extensions/aws/Lambda';

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
```

### Step 3

Use a client extension to call the APIs:

For example, to make calls using Axios:

```typescript
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
```