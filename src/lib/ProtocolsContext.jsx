import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchJSON } from "@/utils/api";

const ProtocolsContext = createContext(null);

export function ProtocolsProvider({ children }) {
  const [protocols, setProtocols] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProtocols() {
      try {
        const res = await fetch("https://api.llama.fi/protocols");
        const data = await res.json();
        console.log("ProtocolsContext - loaded protocols:", data?.length, "items");
        console.log("First protocol:", data?.[0]);
        if (data && Array.isArray(data)) {
          setProtocols(data);
        }
      } catch (err) {
        console.error("Failed to load protocols:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProtocols();
  }, []);

  return (
    <ProtocolsContext.Provider value={{ protocols, loading }}>
      {children}
    </ProtocolsContext.Provider>
  );
}

export function useProtocols() {
  const context = useContext(ProtocolsContext);
  if (!context) {
    throw new Error("useProtocols must be used within a ProtocolsProvider");
  }
  return context;
}