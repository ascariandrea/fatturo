import * as t from "io-ts";
import { date } from "io-ts-types/lib/date";

const currency = t.keyof(
  {
    EUR: null,
    GBP: null
  },
  "Currency"
);

export type Currency = t.TypeOf<typeof currency>;

export const Me = t.interface(
  {
    name: t.string,
    address: t.string,
    zipCode: t.string,
    city: t.string,
    province: t.string,
    vat: t.string
  },
  "Me"
);

type Me = t.TypeOf<typeof Me>;

const invoiceProduct = t.intersection(
  [
    t.interface({
      title: t.string,
      amount: t.number
    }),
    t.partial({
      description: t.string
    })
  ],
  "InvoiceProduct"
);

// type InvoiceProduct = t.TypeOf<typeof invoiceProduct>;
export const Client = t.interface(
  {
    name: t.string,
    address: t.string,
    zipCode: t.string,
    city: t.string,
    province: t.string,
    vat: t.string
  },
  "Client"
);

export type Client = t.TypeOf<typeof Client>;

export const invoiceData = t.interface(
  {
    client: t.string,
    me: t.string,
    date,
    products: t.array(invoiceProduct),
    payment: t.dictionary(t.string, t.string),
    currency: currency
  },
  "InvoiceData"
);

export type InvoiceData = t.TypeOf<typeof invoiceData>;

export interface InvoiceTemplateData
  extends Omit<InvoiceData, "me" | "client" | "payment" | "date"> {
  me: Me;
  client: Client;
  date: string;
}
