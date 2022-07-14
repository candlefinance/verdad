![verdad](https://user-images.githubusercontent.com/2965782/178850715-40efafda-c0fd-4adc-a7d5-35d649b02f7f.png)

# Verdad

Verdad exists to let you write once and use everywhere.

What does it let you write?

## APIs

import * as t from 'io-ts'
import { NumberFromString, UUID } from 'io-ts-types'
import { ISO } from 'verdad/src/core/ISO'

import { VerdadRESTAPI } from 'verdad/src/core/RESTAPI'
import { BooleanLiteralFromString, makeNullable, makePrimitiveBrand } from 'verdad/src/core/Utilities'

import { RobinhoodUtilities as Utilities } from './utilities'

export namespace RobinhoodCrypto {

  // MARK: Primitive models

  // FIXME: Check in brand that all use lower-case letters except RefID in OrderRequest (but not response)
  const AccountID = makePrimitiveBrand(UUID, 'RobinhoodCryptoAccountID')
  const ActivationID = makePrimitiveBrand(UUID, 'RobinhoodCryptoActivationID')
  const CostBasisID = makePrimitiveBrand(UUID, 'RobinhoodCryptoCostBasisID')
  const HoldingID = makePrimitiveBrand(UUID, 'RobinhoodCryptoHoldingID')
  const OrderID = makePrimitiveBrand(UUID, 'RobinhoodCryptoOrderID')
  const RefID = makePrimitiveBrand(UUID, 'RobinhoodCryptoRefID')

  // NOTE: Usually 3 or 4 uppercase letters
  const CurrencyCode = makePrimitiveBrand(t.string, 'RobinhoodCryptoCurrencyCode') 

  // MARK: Response sub-models

  const CostBasis = t.type({
    id: CostBasisID,
    currency_id: Utilities.runtimeTypes.CurrencyID,

    direct_quantity: NumberFromString,
    direct_reward_quantity: NumberFromString,
    direct_transfer_quantity: NumberFromString,
    intraday_quantity: NumberFromString,
    marked_quantity: NumberFromString,

    direct_cost_basis: NumberFromString,
    direct_reward_cost_basis: NumberFromString,
    direct_transfer_cost_basis: NumberFromString,
    intraday_cost_basis: NumberFromString,
    marked_cost_basis: NumberFromString,
  })

  const Currency = t.type({
    id: Utilities.runtimeTypes.CurrencyID,

    code: CurrencyCode,
    increment: NumberFromString,

    brand_color: t.string, // Seems to always be formatted as hex color eg '99C061'
    name: t.string,

    crypto_type: t.union([
      t.literal('BASE_ASSET'),
      t.literal('ERC20')
    ]),
    type: t.union([
      t.literal('cryptocurrency'),
      t.literal('fiat'),
    ]),

    display_only: t.boolean,
  })

  const OrderExecution = t.type({
    effective_price: t.string,
    id: t.string,
    quantity: t.string,
    timestamp: t.string,
  })

  const FeatureStatus = t.intersection([
    Utilities.runtimeTypes.TimestampedModel,
    t.type({
      status: t.literal('active'),
      reason_code: t.literal(''),

      feature: t.union([
        t.literal('deposits'),
        t.literal('withdrawals'),
        t.literal('ny'),
        t.literal('trading'),
      ]),
    })
  ])

  // MARK: Response models

  const Account = t.intersection([
    Utilities.runtimeTypes.TimestampedModel,
    t.type({
      id: AccountID,
      user_id: Utilities.runtimeTypes.UserID,

      apex_account_number: Utilities.runtimeTypes.ApexAccountNumber,
      rhs_account_number: Utilities.runtimeTypes.RHSAccountNumber,

      status: t.literal('active'),
      status_reason_code: t.literal(''),

      feature_statuses: t.array(FeatureStatus),
    })
  ])

  const Activation = t.intersection([
    Utilities.runtimeTypes.TimestampedModel,
    t.type({
      id: ActivationID,
      user_id: Utilities.runtimeTypes.UserID,

      first_name: t.string,
      last_name: t.string,
      email: t.string, // Seems to be always formatted as email eg liamdunn@icloud.com

      external_rejection_code: t.null,
      external_rejection_reason: t.literal(''),
      external_status_code: t.null,

      speculative: t.boolean,
      state: t.union([
        t.literal('in_review'),
        t.literal('approved')
      ]),
      type: t.literal('new_account'),
    })
  ])

  const CurrencyPair = t.type({
    id: Utilities.runtimeTypes.CurrencyPairID,

    max_order_size: NumberFromString,
    min_order_price_increment: NumberFromString,
    min_order_quantity_increment: NumberFromString,
    min_order_size: NumberFromString,

    name: t.string,
    symbol: t.string, // Seems to always be formatted 'X-Y' eg 'ETH-USD'

    tradability: t.union([
      t.literal('tradable'),
      t.literal('untradable')
    ]),
    display_only: t.boolean,

    asset_currency: Currency,
    quote_currency: Currency,
  })

  const Holding = t.intersection([
    Utilities.runtimeTypes.TimestampedModel,
    t.type({
      id: HoldingID,
      account_id: AccountID,

      quantity: NumberFromString,
      quantity_available: NumberFromString,
      quantity_held: NumberFromString,
      quantity_held_for_buy: NumberFromString,
      quantity_held_for_sell: NumberFromString,

      cost_bases: t.array(CostBasis),
      currency: Currency,
    })
  ])

  const Order = t.intersection([
    Utilities.runtimeTypes.TimestampedModel,
    t.type({
      id: OrderID,
      account_id: AccountID,
      currency_pair_id: Utilities.runtimeTypes.CurrencyPairID,
      ref_id: RefID,

      last_transaction_at: makeNullable(ISO.runtimeTypes.CombinedDateTime),

      cumulative_quantity: NumberFromString,
      price: NumberFromString,
      quantity: NumberFromString,
      entered_price: NumberFromString,
      rounded_executed_notional: NumberFromString,
      average_price: makeNullable(NumberFromString),

      time_in_force: t.literal('gtc'),
      state: t.union([
        t.literal('filled'),
        t.literal('unconfirmed'),
        t.literal('confirmed'),
        t.literal('failed'),
        t.literal('canceled')
      ]),
      side: t.union([
        t.literal('buy'),
        t.literal('sell'),
      ]),
      type: t.union([
        t.literal('market'),
        t.literal('limit') // FIXME: Validate with Proxyman
      ]),

      cancel_url: makeNullable(t.string), // FIXME: URL

      // FIXME: Verify value types (non-null variants) in Proxyman
      initiator_id: makeNullable(t.string),
      initiator_type: makeNullable(t.string),

      is_visible_to_user: t.literal(true),
      executions: t.array(OrderExecution),
    }),
    t.partial({
      is_quantity_collared: t.literal(false),
    })
  ])

  // MARK: Request models

  const ActivationRequest = t.type({
    type: t.literal('new_account'),
    speculative: t.boolean,
  })

  const OrderRequest = t.type({
    account_id: AccountID,
    currency_pair_id: Utilities.runtimeTypes.CurrencyPairID,
    ref_id: RefID, // NOTE: MUST use upper-case letters in request 

    time_in_force: t.literal('gtc'),

    side: t.union([
      t.literal('buy'),
      t.literal('sell')
    ]),
    type: t.union([
      t.literal('market'),
      t.literal('limit') // FIXME: Validate with Proxyman
    ]),

    price: t.number,
    quantity: t.number,

    is_quantity_collared: t.literal(false),
  })

  // MARK: Header models

  const StandardHeader = t.intersection([
    Utilities.runtimeTypes.BaseHeader,
    t.type({
      Host: t.literal('nummus.robinhood.com'),
    })
  ])

  const StandardContentHeader = t.intersection([
    StandardHeader,
    Utilities.runtimeTypes.ContentHeaderExtension,
  ])

  // MARK: Path models

  const OrderPath = t.type({
    orderID: OrderID,
  })

  // MARK: Query models

  const ActivationQuery = t.intersection([
    // FIXME: Validate these fields with Proxyman
    Utilities.runtimeTypes.PaginationQuery,
    t.type({
      speculative: new BooleanLiteralFromString(false)
    })
  ])

  const OrderQuery = t.intersection([
    // FIXME: Validate these fields with Proxyman
    Utilities.runtimeTypes.PaginationQuery,
    t.type({
      // FIXME: Robinhood sends up this header field URL-encoded (i.e. not with [])
      'updated_at[gte]': ISO.runtimeTypes.CombinedDateTime
    }),
    t.partial({
      // FIXME: Validate this field with Proxyman
      currency_pair_id: Utilities.runtimeTypes.CurrencyPairID // UUID with lower-case letters
    })
  ])

  const HoldingQuery = t.intersection([
    // FIXME: Validate these fields with Proxyman
    Utilities.runtimeTypes.PaginationQuery,
    // FIXME: Validate these fields with Proxyman
    Utilities.runtimeTypes.NonZeroQuery,
    t.partial({
      currency_id: Utilities.runtimeTypes.CurrencyID
    })
  ])

  // MARK: Model registry

  export const runtimeTypes = {

    // Primitive Models
    AccountID,
    ActivationID,
    CostBasisID,
    HoldingID,
    OrderID,
    RefID,
    CurrencyCode,

    // Header parameter models,
    StandardHeader,
    StandardContentHeader,

    // Path parameter models
    OrderPath,

    // Query parameter models
    ActivationQuery,
    OrderQuery,
    HoldingQuery,

    // Sub-models of request/response models
    CostBasis,
    FeatureStatus,
    Currency,
    OrderExecution,

    // Request object models
    ActivationRequest,
    OrderRequest,

    // Response object models
    Account,
    Activation,
    CurrencyPair,
    Holding,
    Order,

    // Paginated response models
    PaginatedAccounts: Utilities.makePaginationResponse(Account),
    PaginatedActivations: Utilities.makePaginationResponse(Activation),
    PaginatedCurrencyPairs: Utilities.makePaginationResponse(CurrencyPair),
    PaginatedHoldings: Utilities.makePaginationResponse(Holding),
    PaginatedOrders: Utilities.makePaginationResponse(Order),
  }

  export type Compiletime<Name extends keyof typeof runtimeTypes> = t.TypeOf<typeof runtimeTypes[Name]>

  export function named<Name extends keyof typeof runtimeTypes>(name: Name) {
    return { name: name, runtimeType: runtimeTypes[name] }
  }

  // MARK: API methods

  export const api = VerdadRESTAPI.api({
    name: 'Candle',
    servers: {
      prod: 'https://api.candle.fi',
      test: 'https://test-api.candle.fi',
    },
    builder: (ctx) => ({

      activations: VerdadRESTAPI.resource(ctx, ['users', { parameter: 'userID'}, 'activations'], {

        get: (ctx) => VerdadRESTAPI.method(ctx, {
          pathParametersType: RESTResource.namedType(t.type({
            userID: t.string,
          })),
          queryParametersType: RESTResource.namedType(t.type({
            updated_since: DateTime,
          })),
          headerParametersType: RESTResource.namedType(t.type({
            'x-api-version': t.number,
          })),
          requestBodyType: t.null,
          successResponse: {
            statusCodes: Utilities.successStatusCodes,
            bodyType: named('PaginatedActivations'),
          },
          errorResponse: {
            statusCodes: [
                StatusCodes.NOT_FOUND as const,
                StatusCodes.INTERNAL_SERVER_ERROR as const,
            ],
            bodyType: Utilities.named('ErrorResponse'),
          }
        }),

        post: (ctx) => VerdadRESTAPI.method(ctx, {
          pathParametersType: Utilities.named('Empty'),
          queryParametersType: Utilities.named('Empty'),
          headerParametersType: named('StandardContentHeader'),
          requestBodyType: named('ActivationRequest'),
          successResponse: {
            statusCodes: Utilities.successStatusCodes,
            bodyType: named('Activation'),
          },
          errorResponse: {
            statusCodes: [
                StatusCodes.BAD_REQUEST as const,
                StatusCodes.INTERNAL_SERVER_ERROR as const,
            ],
            bodyType: Utilities.named('ErrorResponse'),
          }
        }),

        delete: () => undefined,
        patch: () => undefined,
        put: () => undefined,
      }),
    })
  })
}

## Databases

How does it let you use those things?

- 

 allows you to quickly define a single source of truth for your API across mobile, frontend, and backend, reducing bugs and enabling us to build and ship faster.
Define a single source of truth for your API and persistence layer, and use Verdad's extensions to a) call it, b) implement it, and c) deploy it.