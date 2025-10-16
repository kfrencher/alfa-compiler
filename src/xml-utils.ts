/**
 * XML formatting utilities
 */

/**
 * Format XML string with proper indentation
 * @param xml - Raw XML string
 * @param indent - Number of spaces for indentation
 * @returns Formatted XML
 */
function formatXml(xml: string, indent: number = 2): string {
  const PADDING = ' '.repeat(indent);
  const reg = /(>)(<)(\/*)/g;
  let formatted = xml.replace(reg, '$1\n$2$3');
  
  let pad = 0;
  return formatted.split('\n').map((line) => {
    let indent = 0;
    if (line.match(/.+<\/\w[^>]*>$/)) {
      indent = 0;
    } else if (line.match(/^<\/\w/) && pad > 0) {
      pad -= 1;
    } else if (line.match(/^<\w[^>]*[^\/]>.*$/)) {
      indent = 1;
    } else {
      indent = 0;
    }
    
    const padding = PADDING.repeat(pad);
    pad += indent;
    return padding + line;
  }).join('\n');
}

/**
 * Minify XML by removing unnecessary whitespace
 * @param xml - Formatted XML string
 * @returns Minified XML
 */
function minifyXml(xml: string): string {
  return xml
    .replace(/>\s+</g, '><')
    .replace(/^\s+|\s+$/gm, '')
    .replace(/\n/g, '');
}

export { formatXml, minifyXml };