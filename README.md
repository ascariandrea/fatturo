# Fatturo

A very opinionated CLI tool to render an invoice from a template.

## Installation

```sh
$ npm i -g fatturo
```

## Configuration

`fatturo` looks for `fatturo.yaml` in the current working directory to read the configuration.
It can be overriden by specifying the argument `-c`.

```sh
$ fatturo -c my-config.yaml -n 1
```

## Usage

```sh
$ fatturo -n [invoice number] -c [config file path]
```
