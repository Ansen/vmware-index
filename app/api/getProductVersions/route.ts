import { NextRequest, NextResponse } from 'next/server';
// We cannot import 'zlib' or 'pako' here as per instructions (no new dependencies)
// We will rely on `fetch` to handle Content-Encoding: gzip if server provides it.

interface ProductConfig {
  id: string;
  name: string;
  xmlFile: string;
  // filenamePattern is no longer needed as final filename comes from core-metadata.xml
}

const products: ProductConfig[] = [
  { id: 'ws-windows', name: 'VMware Workstation Pro for Windows', xmlFile: 'ws-windows.xml' },
  { id: 'ws-linux', name: 'VMware Workstation Pro for Linux', xmlFile: 'ws-linux.xml' },
  { id: 'fusion-universal', name: 'VMware Fusion Pro for macOS (Universal)', xmlFile: 'fusion-universal.xml' },
  { id: 'fusion-arm64', name: 'VMware Fusion Pro for macOS (ARM64)', xmlFile: 'fusion-arm64.xml' },
  { id: 'fusion-intel', name: 'VMware Fusion Pro for macOS (Intel)', xmlFile: 'fusion.xml' },
];

// Interface for the data this API route will return to the client
interface SelectableVersion {
  idForClientSelection: string; // Unique key for dropdown, e.g., "15.5.0_14665864_windows"
  displayVersion: string;       // e.g., "15.5.0 (Build 14665864) - Windows"
  // Data needed for the client to make the next API call to /api/download-details
  version: string;              // e.g., "15.5.0"
  build: string;                // e.g., "14665864"
  platformOrArch: string;       // e.g., "windows", "linux", "universal", "arm64", "x86"
}

const BASE_XML_URL = "https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');

  if (!productId) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
  }

  const productConfig = products.find(p => p.id === productId);
  if (!productConfig) {
    return NextResponse.json({ error: 'Selected product configuration not found' }, { status: 404 });
  }

  try {
    const mainXmlResponse = await fetch(`${BASE_XML_URL}${productConfig.xmlFile}`, { cache: 'no-store' });
    if (!mainXmlResponse.ok) {
      return NextResponse.json({ error: `Failed to fetch main XML (${mainXmlResponse.status})` }, { status: mainXmlResponse.status });
    }
    const mainXmlText = await mainXmlResponse.text();
    if (!mainXmlText || !mainXmlText.trim().startsWith('<')) {
      return NextResponse.json({ error: 'Received empty or malformed main XML data.' }, { status: 500 });
    }

    const versionsMap = new Map<string, SelectableVersion>();
    const metaMatches = mainXmlText.matchAll(/<metadata>([\s\S]*?)<\/metadata>/g);
    
    for (const match of metaMatches) {
      const metadataContent = match[1];
      const urlMatch = metadataContent.match(/<url>([^<]+)<\/url>/);
      if (urlMatch && urlMatch[1]) {
        const urlPath = urlMatch[1].trim(); // e.g., ws/17.6.3/24583834/windows/core/metadata.xml.gz
                                           // or fusion/13.0.2/21581413/universal/core/metadata.xml.gz
        const parts = urlPath.split('/');
        // Expecting structure: productCode/version/build/platformOrArch/type/...
        // For Fusion, 'type' can be 'core'. For Workstation, 'type' can be 'core' or 'packages'.
        if (parts.length >= 4) {
            const version = parts[1];
            const build = parts[2];
            const platformOrArch = parts[3]; // This is the 4th segment.
            
            const uniqueKey = `${version}_${build}_${platformOrArch}`;
            if (!versionsMap.has(uniqueKey)) {
                let displayPlatform = platformOrArch.charAt(0).toUpperCase() + platformOrArch.slice(1);
                if (platformOrArch === "ws-windows") displayPlatform = "Windows"; // Example specific override if needed
                if (platformOrArch === "ws-linux") displayPlatform = "Linux";

                versionsMap.set(uniqueKey, {
                  idForClientSelection: uniqueKey,
                  displayVersion: `${version} (Build ${build}) - ${displayPlatform}`,
                  version: version,
                  build: build,
                  platformOrArch: platformOrArch,
                });
            }
        }
      }
    }

    const uniqueVersionsArray = Array.from(versionsMap.values());

    if (uniqueVersionsArray.length === 0) {
      return NextResponse.json({ error: `No versions found for ${productConfig.name} in ${productConfig.xmlFile}.`, versions: [] }, { status: 200 });
    }

    // Sort versions: newest first by version, then by build
    uniqueVersionsArray.sort((a, b) => {
      const aVerParts = a.version.split('.').map(Number);
      const bVerParts = b.version.split('.').map(Number);
      for (let i = 0; i < Math.max(aVerParts.length, bVerParts.length); i++) {
        const aPart = aVerParts[i] || 0;
        const bPart = bVerParts[i] || 0;
        if (aPart !== bPart) return bPart - aPart;
      }
      return parseInt(b.build, 10) - parseInt(a.build, 10);
    });

    return NextResponse.json(uniqueVersionsArray);

  } catch (e: any) {
    console.error(`Error processing request for ${productId} in /api/getProductVersions:`, e);
    return NextResponse.json({ error: `Server error processing versions: ${e.message}` }, { status: 500 });
  }
}