function safeJsonLd(data: object | object[]) {
  return JSON.stringify(Array.isArray(data) ? data : [data])
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// Renders a JSON-LD <script>. Escapes characters that could break out of a
// script tag if listing text ever contains unusual characters.
export function JsonLd({ data }: { data: object | object[] }) {
  const json = safeJsonLd(data);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
