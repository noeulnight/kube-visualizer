import { useState, useEffect } from "react";
import type { ResourceData } from "../types/resources";

export const useResourceDetail = (resourceId: string | null) => {
  const [resource, setResource] = useState<ResourceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!resourceId) {
      setResource(null);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchResource = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `http://localhost:3000/api/resource/${encodeURIComponent(resourceId)}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch resource: ${response.statusText}`);
        }

        const data = await response.json();
        setResource(data);
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error("Unknown error occurred")
        );
        setResource(null);
      } finally {
        setLoading(false);
      }
    };

    fetchResource();
  }, [resourceId]);

  return { resource, loading, error };
};
