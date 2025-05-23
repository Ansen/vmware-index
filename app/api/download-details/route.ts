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
  const productId = searchParams.get('productId');
  const version = searchParams.get('version');
  const build = searchParams.get('build');
  const platformOrArch = searchParams.get('platformOrArch'); // e.g., "windows", "linux", "universal", "arm64"

  if (!productId || !version || !build || !platformOrArch) {
    return NextResponse.json({ error: 'productId, version, build, and platformOrArch are required' }, { status: 400 });
  }

  const gzUrlPathsToFetch: { type: string, url: string, pathFragment: string }[] = [];
  const productShortName = productId.startsWith('ws-') ? 'ws' : 'fusion';

  if (productId.startsWith('ws-')) { // Workstation products
    gzUrlPathsToFetch.push({
        type: 'core',
        url: `${productShortName}/${version}/${build}/${platformOrArch}/core/metadata.xml.gz`,
        pathFragment: `${productShortName}/${version}/${build}/${platformOrArch}/core/`
    });
    gzUrlPathsToFetch.push({
        type: 'packages',
        url: `${productShortName}/${version}/${build}/${platformOrArch}/packages/metadata.xml.gz`,
        pathFragment: `${productShortName}/${version}/${build}/${platformOrArch}/packages/`
    });
  } else if (productId.startsWith('fusion-')) { // Fusion products
    gzUrlPathsToFetch.push({
        type: 'core', // Fusion typically has 'core' type
        url: `${productShortName}/${version}/${build}/${platformOrArch}/core/metadata.xml.gz`,
        pathFragment: `${productShortName}/${version}/${build}/${platformOrArch}/core/`
    });
  } else {
    return NextResponse.json({ error: 'Unknown product type for constructing .gz URLs' }, { status: 400 });
  }
  
  const allDownloadableItems: DownloadableItemDetail[] = [];

  for (const { type, url: gzUrlPath, pathFragment } of gzUrlPathsToFetch) {
    try {
      const gzResponse = await fetch(`${BASE_XML_URL}${gzUrlPath}`, { cache: 'no-store' });

      if (!gzResponse.ok) {
        // For packages, it's often a 404, which is acceptable if core exists.
        if (type === 'packages' && gzResponse.status === 404) {
            console.log(`No 'packages' metadata found for ${productId} version ${version} (at ${gzUrlPath}), skipping.`);
            continue;
        }
        console.warn(`Failed to fetch ${type} GZ for ${gzUrlPath}: ${gzResponse.status}`);
        // Don't immediately fail the whole request if one part (like packages) fails,
        // but log it. If core fails, it's more critical.
        if (type === 'core') {
             // Propagate core fetch error
             return NextResponse.json({ error: `Failed to fetch core GZ (${gzResponse.status}) from ${gzUrlPath}` }, { status: gzResponse.status });
        }
        continue;
      }
      
      const gzipBuffer = await gzResponse.arrayBuffer();
      if (!gzipBuffer || gzipBuffer.byteLength === 0) {
        console.warn(`Received empty GZ buffer for ${gzUrlPath}`);
        continue;
      }

      let innerXmlText: string;
      try {
        const decompressedBuffer = await gunzip(Buffer.from(gzipBuffer));
        innerXmlText = decompressedBuffer.toString('utf-8');
      } catch (unzipError: any) {
        console.warn(`Failed to decompress Gzip for ${gzUrlPath}: ${unzipError.message}`);
        continue;
      }
      
      if (!innerXmlText || !innerXmlText.trim().startsWith('<')) {
        console.warn(`Decompressed data is not valid XML for ${gzUrlPath}.`);
        continue;
      }

      const itemsFromThisXml = extractDownloadableItemsFromInnerXml(innerXmlText, pathFragment);
      allDownloadableItems.push(...itemsFromThisXml);

    } catch (e: any) {
      console.error(`Error processing ${type} GZ for ${gzUrlPath}:`, e);
      // Continue to next .gz file if one fails, unless it's a critical failure
    }
  }

  if (allDownloadableItems.length === 0) {
    return NextResponse.json({ error: `No downloadable items found for ${productId} version ${version} build ${build} platform ${platformOrArch}.` , items: [] }, { status: 200 });
  }
  
  return NextResponse.json(allDownloadableItems);
}