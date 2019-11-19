declare module 'wkhtmltopdf' {
    function wkhtmltopdf(stream: NodeJS.ReadableStream): NodeJS.ReadableStream;


    export = wkhtmltopdf;
}