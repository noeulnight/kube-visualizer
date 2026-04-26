import { useState } from "react";
import type { GraphNode } from "../types/graph";
import ResourceIcon from "./ResourceIcon";

interface ResourceSearchProps {
  nodes: GraphNode[];
  onSelectNode: (nodeId: string) => void;
}

export default function ResourceSearch({
  nodes,
  onSelectNode,
}: ResourceSearchProps) {
  const [filterValue, setFilterValue] = useState<string>("");

  const handleSelect = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      onSelectNode(nodeId);
      setFilterValue("");
    }
  };

  const filteredNodes = filterValue
    ? nodes.filter((node) => {
        const label = node.data.label;
        return (
          node.id.toLowerCase().includes(filterValue.toLowerCase()) ||
          label.toLowerCase().includes(filterValue.toLowerCase())
        );
      })
    : [];

  // Limit to top 15 results
  const resultNodes = filteredNodes.slice(0, 15);

  return (
    <div className="flex flex-col gap-2 w-96">
      <div className="bg-white/5 backdrop-blur-md p-2 rounded-lg border border-white/10 shadow-xl flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-white/50"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clipRule="evenodd"
          />
        </svg>
        <input
          type="text"
          className="bg-transparent border-none outline-none text-white text-xs flex-1"
          placeholder="Search resources by name..."
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        />
        {filterValue && (
          <button
            onClick={() => setFilterValue("")}
            className="text-white/30 hover:text-white/70 transition-colors"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {resultNodes.length > 0 && (
        <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 shadow-xl max-h-[85vh] overflow-hidden flex flex-col w-96">
          <div className="overflow-y-auto no-scrollbar">
            {resultNodes.map((node) => {
              // Extract type from node.type or id
              const resourceType =
                Object.keys(typeDisplayMap).find(
                  (key) => typeDisplayMap[key].toLowerCase() === node.type,
                ) || "Pod";

              const label = node.data.label || node.id;

              return (
                <button
                  key={node.id}
                  onClick={() => handleSelect(node.id)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-white/10 transition-colors text-left group border-b border-white/[0.02]"
                >
                  <ResourceIcon
                    resourceType={resourceType}
                    className="w-5 h-5 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-medium truncate group-hover:text-blue-400">
                      {label}
                    </div>
                    <div className="text-[10px] text-white/40 truncate font-mono">
                      {node.id}
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredNodes.length > 15 && (
              <div className="p-2 text-center text-[10px] text-white/30 italic border-t border-white/5">
                Showing top 15 of {filteredNodes.length} results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const typeDisplayMap: Record<string, string> = {
  Namespace: "namespace",
  Node: "node",
  Pod: "pod",
  Service: "service",
  Ingress: "ingress",
  Deployment: "deployment",
  ReplicaSet: "replicaSet",
  DaemonSet: "daemonSet",
  StatefulSet: "statefulSet",
  ConfigMap: "configMap",
  Secret: "secret",
  ServiceAccount: "serviceAccount",
  EndpointSlice: "endpointSlice",
  PersistentVolume: "persistentVolume",
  PersistentVolumeClaim: "persistentVolumeClaim",
};
