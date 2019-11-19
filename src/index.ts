import * as fs from 'fs'
import wkhtmltopdf from 'wkhtmltopdf'
import * as path from 'path'
import * as TE from 'fp-ts/lib/TaskEither'
import * as E from 'fp-ts/lib/Either'
import {
  invoiceData,
  InvoiceTemplateData,
  Currency,
  Me,
  Client
} from './types/invoice'
import { Transform } from 'stream'
import { pipe } from 'fp-ts/lib/pipeable'
import * as t from 'io-ts'
import mustache from 'mustache'
import { PathReporter } from 'io-ts/lib/PathReporter'
import parseArgs from 'minimist'
import { args, Args } from './types/args'
import { Config } from './types/config'
import debug from 'debug'
import * as YAML from 'node-yaml'
import { sequenceS } from 'fp-ts/lib/Apply'

const deb = debug('fatturo')

const toError = (errs: t.Errors): Error => {
  const e = new Error('Validation error.')
  e.message = PathReporter.report(E.left(errs)).join('\n')
  return e
}

const getCurrency = (c: Currency): string => {
  switch (c) {
    case 'GBP':
      return '£'
    case 'EUR':
    default:
      return '€'
  }
}

const readYAMLFile = (path: string): E.Either<Error, unknown> => {
  return E.tryCatch(() => YAML.readSync(path), E.toError)
}

const templateRenderingTransformation = (data: InvoiceTemplateData) => {
  return new Transform({
    transform(chunk, _encoding, cb) {
      pipe(
        E.tryCatch(
          () => mustache.render(chunk.toString('utf8'), data),
          E.toError
        ),
        E.map(c => this.push(c)),
        E.fold(e => cb(e), () => cb())
      )
    }
  })
}

const createPdf = (
  c: Required<Config>,
  invoiceNumber: number
): TE.TaskEither<Error, string> => {
  require('ts-node/register')

  const dataPath = path.resolve(
    process.cwd(),
    c.dataDir,
    `${invoiceNumber}.yaml`
  )

  deb('Reading data: %s', [dataPath])

  const data = pipe(
    readYAMLFile(dataPath),
    E.chain(c => E.mapLeft(toError)(invoiceData.decode(c))),
    E.chain(({ me, client, ...invoice }) => {
      return sequenceS(E.either)({
        me: pipe(
          readYAMLFile(path.resolve(process.cwd(), c.dataDir, `${me}.yaml`)),
          E.chain(c => E.mapLeft(toError)(Me.decode(c)))
        ),
        client: pipe(
          readYAMLFile(
            path.resolve(process.cwd(), c.dataDir, `${client}.yaml`)
          ),
          E.chain(c => E.mapLeft(toError)(Client.decode(c)))
        ),
        invoice: E.right(invoice)
      })
    })
  )

  return pipe(
    TE.fromEither(data),
    TE.map(({ me, client, invoice }) => {
      const [month, day, year] = Intl.DateTimeFormat('en-GB', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      })
        .format(invoice.date)
        .split('/')

      return {
        ...invoice,
        me,
        client,
        date: `${day}/${month}/${year}`,
        number: invoiceNumber,
        total: invoice.products.reduce((acc, p) => acc + p.amount, 0),
        payment: Object.entries(invoice.payment).map(([key, value]) => ({
          key,
          value
        })),
        currencySymbol: getCurrency(invoice.currency)
      }
    }),
    TE.chainFirst(d =>
      TE.taskEither.of(
        deb(
          'Created write stream for file %s',
          path.resolve(
            process.cwd(),
            c.outDir,
            `${invoiceNumber}-${d.client.name
              .replace(/\./g, '')
              .split(' ')
              .join('-')}.pdf`
          )
        )
      )
    ),
    TE.chain(d =>
      TE.tryCatch(() => {
        return new Promise<string>((resolve, reject) => {
          const t = templateRenderingTransformation(d)
          const r = fs
            .createReadStream(path.resolve(process.cwd(), c.template))
            .pipe(t)

          const w = fs.createWriteStream(
            path.resolve(
              process.cwd(),
              c.outDir,
              `${invoiceNumber}-${d.client.name.split(' ').join('-')}.pdf`
            )
          )

          // write file stream
          w.on('open', e => {
            deb('Opening write stream %s', e)
          })

          w.on('close', () => {
            deb('File written!')
            resolve(w.path.toString('utf8'))
          })

          w.on('error', e => {
            deb('An error occured %o', e)
          })

          // transform stream
          t.on('data', () => {
            deb('Reading transform content')
          })

          t.on('error', e => {
            deb('Error occured %o', e)
            reject(e)
          })

          // template read stream
          r.on('data', () => {
            deb('Reading template content')
          })

          r.on('error', e => {
            deb('Template read stream error %O', e)
          })

          r.on('end', () => {
            deb('Template read stream ended')
          })

          try {
            wkhtmltopdf(r).pipe(w)
          } catch (e) {
            console.log(e)
            reject(e)
          }
        })
      }, E.toError)
    )
  )
}

const applyConfigDefault = (c: Config): Required<Config> => ({
  dateFormat: 'Y-m-d',
  template: c.template || './templates/default.html',
  dataDir: c.dataDir || './data',
  outDir: c.outDir || './invoices'
})

const decodeArgs = (arvs: string[]): E.Either<Error, Args> =>
  E.mapLeft(toError)(args.decode(parseArgs(arvs)))

const parseConfig = (args: Args): E.Either<Error, Required<Config>> => {
  return pipe(
    readYAMLFile(path.resolve(process.cwd(), args.c || './fatturo.yaml')),
    E.chainFirst(c => E.either.of(deb('Configuration: %O', c))),
    // E.chain(content => E.parseJSON(content, E.toError)),
    // E.chain(content => E.tryCatch(() => YAML.readSync(), E.toError)),
    E.chain(config => E.mapLeft(toError)(Config.decode(config))),
    E.map(applyConfigDefault),
    E.chainFirst(c => E.either.of(deb('Configuration: %O', c)))
  )
}

export const program = (args: any[]) => {
  pipe(
    TE.fromEither(decodeArgs(args)),
    TE.chain(args =>
      pipe(
        TE.fromEither(parseConfig(args)),
        TE.chain(config => createPdf(config, args.n))
      )
    )
  )().then(
    E.bimap(
      e => {
        console.error('An error has occured', e)
        process.exit(-1)
      },
      path => {
        console.log(`File created at ${path}`)
        process.exit(0)
      }
    )
  )
}

program(process.argv.slice(2))
