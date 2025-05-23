"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from "react";

interface ProductConfig {
  id: string;
  name: string;
  xmlFile: string;
  // filenamePattern removed as it's no longer used on client for link generation
}

const products: ProductConfig[] = [
  { id: 'ws-windows', name: 'VMware Workstation Pro for Windows', xmlFile: 'ws-windows.xml' },
  { id: 'ws-linux', name: 'VMware Workstation Pro for Linux', xmlFile: 'ws-linux.xml' },
  { id: 'fusion-universal', name: 'VMware Fusion Pro for macOS (Universal)', xmlFile: 'fusion-universal.xml' },
  { id: 'fusion-arm64', name: 'VMware Fusion Pro for macOS (ARM64)', xmlFile: 'fusion-arm64.xml' },
  { id: 'fusion-intel', name: 'VMware Fusion Pro for macOS (Intel)', xmlFile: 'fusion.xml' },
  { id: 'player-linux', name: 'VMware Player for Linux', xmlFile: 'player-linux.xml' },
  { id: 'player-windows', name: 'VMware Player for Windows', xmlFile: 'player-windows.xml' },
];

// Interface for data from /api/getProductVersions (should match server)
interface SelectableVersion {
  idForClientSelection: string;
  displayVersion: string;
  version: string;
  build: string;
  platformOrArch: string;
  gzFilePath: string; // Added to store the path to the metadata.xml.gz file
  // coreMetadataUrlPath and initialPathFragment are not directly sent to client by this API anymore
}

// Interface for data from /api/download-details (this is an array of items)
interface DownloadableItem {
  name: string;
  pathFragment: string;
  finalFileName: string;
}

// const BASE_XML_URL = "https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/"; // Not needed
const BASE_DOWNLOAD_URL = "https://softwareupdate-prod.broadcom.com/cds/vmw-desktop/";

export default function Home() {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [versions, setVersions] = useState<SelectableVersion[]>([]); // Use corrected interface
  const [selectedVersionKey, setSelectedVersionKey] = useState<string>(""); // Stores idForClientSelection
  const [downloadItems, setDownloadItems] = useState<DownloadableItem[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState<boolean>(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Effect to fetch version list when product changes
  useEffect(() => {
    if (!selectedProductId) {
      setVersions([]);
      setSelectedVersionKey("");
      setDownloadItems([]);
      setError("");
      return;
    }

    const fetchProductVersionList = async () => {
      setIsLoadingVersions(true);
      setError("");
      setVersions([]);
      setSelectedVersionKey("");
      setDownloadItems([]);

      try {
        const response = await fetch(`/api/getProductVersions?productId=${selectedProductId}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: `Failed to fetch versions list (${response.status})` }));
          throw new Error(errorData.error || `Failed to fetch versions list (${response.status})`);
        }
        const fetchedData: SelectableVersion[] | { error?: string, versions?: SelectableVersion[] } = await response.json();

        if ('error' in fetchedData && fetchedData.error) {
            setError(fetchedData.error);
            setVersions(fetchedData.versions || []);
        } else if (Array.isArray(fetchedData)) {
            setVersions(fetchedData);
            if (fetchedData.length === 0) {
                setError("No versions found for this product.");
            }
        } else {
            throw new Error("Received invalid data structure for versions list from API.");
        }
      } catch (e: any) {
        setError(`Error fetching versions list: ${e.message}`);
        console.error("Error in fetchProductVersionList:", e);
      } finally {
        setIsLoadingVersions(false);
      }
    };

    fetchProductVersionList();
  }, [selectedProductId]);

  // Function to handle fetching and displaying downloadable items
  const handleShowDownloadableItems = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setDownloadItems([]);

    if (!selectedProductId || !selectedVersionKey) {
      setError("Please select both a product and a version.");
      return;
    }

    const selectedVersionData = versions.find(v => v.idForClientSelection === selectedVersionKey);
    if (!selectedVersionData) {
      setError("Selected version details not found. Please re-select.");
      setIsLoadingDetails(false); // Ensure loading state is reset
      return;
    }

    setIsLoadingDetails(true);
    try {
      const apiUrl = `/api/download-details?productId=${selectedProductId}&version=${selectedVersionData.version}&build=${selectedVersionData.build}&platformOrArch=${selectedVersionData.platformOrArch}&gzFilePath=${encodeURIComponent(selectedVersionData.gzFilePath)}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Failed to fetch download items (${response.status})` }));
        throw new Error(errorData.error || `Failed to fetch download items (${response.status})`);
      }
      
      const fetchedItemsData: DownloadableItem[] | { error?: string, items?: DownloadableItem[] } = await response.json();

      if ('error' in fetchedItemsData && fetchedItemsData.error) {
          setError(fetchedItemsData.error);
          setDownloadItems(fetchedItemsData.items || []);
      } else if (Array.isArray(fetchedItemsData)) {
          setDownloadItems(fetchedItemsData);
           if (fetchedItemsData.length === 0) {
                setError("No downloadable items found for this version.");
            }
      } else {
          throw new Error("Received invalid data structure for download items.");
      }

    } catch (e: any) {
      setError(`Error fetching download items: ${e.message}`);
      console.error("Error in handleShowDownloadableItems:", e);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-8 min-h-screen font-sans">
      <header className="mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-center text-gray-800">VMware Product Download Link Generator</h1>
        <p className="text-center text-gray-600 mt-2">Select a product and version to get the official download link.</p>
      </header>

      <form onSubmit={handleShowDownloadableItems} className="max-w-lg mx-auto bg-white p-6 sm:p-8 rounded-xl shadow-lg">
        {error && <p className="text-red-600 bg-red-100 p-3 rounded-md mb-4 text-sm">{error}</p>}

        <div className="mb-6">
          <label htmlFor="product-select" className="block text-sm font-semibold text-gray-700 mb-1">
            Product:
          </label>
          <select
            id="product-select"
            value={selectedProductId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              setSelectedProductId(e.target.value);
              setSelectedVersionKey("");
              setDownloadItems([]);
            }}
            className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm appearance-none"
          >
            <option value="">-- Select a Product --</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {selectedProductId && (
          <div className="mb-6">
            <label htmlFor="version-select" className="block text-sm font-semibold text-gray-700 mb-1">
              Version:
            </label>
            {isLoadingVersions ? (
              <div className="mt-1 block w-full pl-3 pr-10 py-2.5 text-gray-500 border border-gray-300 rounded-md shadow-sm bg-gray-50">Loading versions...</div>
            ) : versions.length > 0 ? (
              <select
                id="version-select"
                value={selectedVersionKey}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  setSelectedVersionKey(e.target.value);
                  setDownloadItems([]); // Reset download items on version change
                }}
                className="mt-1 block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm appearance-none"
                disabled={isLoadingVersions}
              >
                <option value="">-- Select a Version --</option>
                {versions.map(v => (
                  <option key={v.idForClientSelection} value={v.idForClientSelection}>{v.displayVersion}</option>
                ))}
              </select>
            ) : !isLoadingVersions && selectedProductId && (!error || versions.length === 0) ? (
                 <div className="mt-1 block w-full pl-3 pr-10 py-2.5 text-gray-500 border border-gray-300 rounded-md shadow-sm bg-gray-50">
                   {error && versions.length === 0 ? "Could not load versions." : "No versions found for this product."}
                 </div>
            ) : null }
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-60 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={isLoadingVersions || isLoadingDetails || !selectedProductId || !selectedVersionKey}
        >
          {isLoadingDetails ? "Fetching Details..." : "Show Downloadable Files"}
        </button>
      </form>

      {downloadItems.length > 0 && (
        <div className="mt-10 max-w-xl mx-auto bg-gray-50 p-5 rounded-xl shadow-lg">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Downloadable Files:</h2>
          <ul className="space-y-3">
            {downloadItems.map((item, index) => {
              const fullLink = `${BASE_DOWNLOAD_URL}${item.pathFragment}${item.finalFileName}`;
              return (
                <li key={index} className="p-3 bg-white rounded-md shadow border border-gray-200">
                  <p className="font-medium text-gray-700 break-all">{item.name}</p>
                  <a
                    href={fullLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-700 break-all underline block my-1"
                  >
                    {fullLink}
                  </a>
                  <button
                    onClick={() => navigator.clipboard.writeText(fullLink)}
                    className="mt-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium py-1 px-2.5 rounded-md shadow"
                    title="Copy Link"
                  >
                    Copy Link
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      
      <footer className="text-center mt-16 mb-8 text-xs text-gray-500">
        <p>Data is sourced from official Broadcom/VMware update servers.</p>
        <p>This tool is provided as-is for convenience. All trademarks are property of their respective owners.</p>
      </footer>
    </div>
  );
}
