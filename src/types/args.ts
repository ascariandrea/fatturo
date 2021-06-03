import * as t from 'io-ts'

export const args = t.intersection(
  [
    t.interface({ n: t.number }, 'Number'),
    t.partial(
      {
        c: t.string,
        noEmit: t.boolean,
      },
      'Config'
    )
  ],
  'Args'
)

export type Args = t.TypeOf<typeof args>
