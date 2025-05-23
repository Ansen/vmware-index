import { NextRequest, NextResponse } from 'next/server';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

const BASE_XML_URL = "https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/";

// Helper function to extract content using regex (simplified XML parsing)
// These functions are duplicated from getProductVersions/route.ts
// In a real application, these would be in a shared utility file.
function extractXmlTagContent(xml: string, tagName: string): string | null {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([^<]+)<\/${tagName}>`));
  return match && match[1] ? match[1].trim() : null;
}

// function extractProductVersionFromCoreXml(coreXml: string): string | null {
//     // Path: <bulletin><productList><product><version>
//     const bulletinMatch = coreXml.match(/<bulletin>([\s\S]*?)<\/bulletin>/);
//     if (bulletinMatch && bulletinMatch[1]) {
//         const productListMatch = bulletinMatch[1].match(/<productList>([\s\S]*?)<\/productList>/);
//         if (productListMatch && productListMatch[1]) {
//             const productMatch = productListMatch[1].match(/<product>([\s\S]*?)<\/product>/);
//             if (productMatch && productMatch[1]) {
//                 return extractXmlTagContent(productMatch[1], "version");
//             }
//         }
//     }
//     return null;
// }

// Updated to extract all components from a core/packages XML
interface DownloadableItemDetail {
  name: string;
  pathFragment: string;
  finalFileName: string;
}

// Parses a core-metadata.xml or packages-metadata.xml text and returns all downloadable components
function extractDownloadableItemsFromInnerXml(innerXmlText: string, pathFragmentToGz: string): DownloadableItemDetail[] {
    const items: DownloadableItemDetail[] = [];
    const bulletinMatches = innerXmlText.matchAll(/<bulletin>([\s\S]*?)<\/bulletin>/g);

    for (const bulletinMatch of bulletinMatches) {
        const bulletinContent = bulletinMatch[1];
        const componentListMatches = bulletinContent.matchAll(/<componentList>([\s\S]*?)<\/componentList>/g);
        for (const componentListMatch of componentListMatches) {
            const componentListContent = componentListMatch[1];
            const componentMatches = componentListContent.matchAll(/<component>([\s\S]*?)<\/component>/g);
            for (const componentMatch of componentMatches) {
                const componentContent = componentMatch[1];
                const relativePath = extractXmlTagContent(componentContent, "relativePath");
                let name = extractXmlTagContent(componentContent, "payload"); // Prefer <payload> for name
                if (!name) name = extractXmlTagContent(componentContent, "componentID"); // Fallback to componentID
                if (!name) name = relativePath; // Fallback to relativePath if others are missing

                if (relativePath && name) {
                    items.push({
                        name: name,
                        pathFragment: pathFragmentToGz, // The path to the directory of the .gz file
                        finalFileName: relativePath
                    });
                }
            }
        }
    }
    return items;
}


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gzFilePath = searchParams.get('gzFilePath');

  if (!gzFilePath) {
    return NextResponse.json({ error: 'gzFilePath is required' }, { status: 400 });
  }

  // Derive pathFragment from gzFilePath (e.g., "fusion/11.1.0/13668589/core/")
  const pathParts = gzFilePath.split('/');
  if (pathParts.length < 2) {
    return NextResponse.json({ error: 'Invalid gzFilePath format' }, { status: 400 });
  }
  const pathFragmentToGz = pathParts.slice(0, -1).join('/') + '/';

  try {
    const gzResponse = await fetch(`${BASE_XML_URL}${gzFilePath}`, { cache: 'no-store' });

    if (!gzResponse.ok) {
      console.error(`Failed to fetch GZ file for ${gzFilePath}: ${gzResponse.status}`);
      return NextResponse.json({ error: `Failed to fetch GZ file (${gzResponse.status}) from ${gzFilePath}` }, { status: gzResponse.status });
    }
    
    const gzipBuffer = await gzResponse.arrayBuffer();
    if (!gzipBuffer || gzipBuffer.byteLength === 0) {
      console.error(`Received empty GZ buffer for ${gzFilePath}`);
      return NextResponse.json({ error: 'Received empty GZ buffer.' }, { status: 500 });
    }

    let innerXmlText: string;
    try {
      const decompressedBuffer = await gunzip(Buffer.from(gzipBuffer));
      innerXmlText = decompressedBuffer.toString('utf-8');
    } catch (unzipError: any) {
      console.error(`Failed to decompress Gzip for ${gzFilePath}: ${unzipError.message}`);
      return NextResponse.json({ error: `Failed to decompress Gzip data: ${unzipError.message}` }, { status: 500 });
    }
    
    if (!innerXmlText || !innerXmlText.trim().startsWith('<')) {
      console.warn(`Decompressed data is not valid XML for ${gzFilePath}.`);
      return NextResponse.json({ error: 'Decompressed data is not valid XML.' }, { status: 500 });
    }

    const downloadableItems = extractDownloadableItemsFromInnerXml(innerXmlText, pathFragmentToGz);

    if (downloadableItems.length === 0) {
      return NextResponse.json({ error: `No downloadable items found in ${gzFilePath}.`, items: [] }, { status: 200 });
    }
    
    return NextResponse.json(downloadableItems);

  } catch (e: any) {
    console.error(`Error processing request for ${gzFilePath} in /api/download-details:`, e);
    return NextResponse.json({ error: `Server error processing download details: ${e.message}` }, { status: 500 });
  }
}