import type { Node } from "@xyflow/react";
import { typeMapping } from "../types/resources";

interface ResourceTypeFilterProps {
  allNodes: Node[];
  visibleResourceTypes: Set<string>;
  setVisibleResourceTypes: (types: Set<string>) => void;
}

export default function ResourceTypeFilter({
  allNodes,
  visibleResourceTypes,
  setVisibleResourceTypes,
}: ResourceTypeFilterProps) {
  return (
    <div className="bg-white/5 backdrop-blur-md p-3 rounded-lg border border-white/10 shadow-xl max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-semibold text-sm">Resource Types</h3>
      </div>
      <div className="flex flex-col gap-1 mb-3">
        {Object.keys(typeMapping).map((resourceType) => {
          const count = allNodes.filter(
            (node) => node.type === typeMapping[resourceType],
          ).length;
          return (
            <label
              key={resourceType}
              className="flex items-center gap-2 text-white text-xs cursor-pointer hover:bg-white/10 p-1 rounded"
            >
              <input
                type="checkbox"
                checked={visibleResourceTypes.has(typeMapping[resourceType])}
                onChange={(e) => {
                  const newSet = new Set(visibleResourceTypes);
                  if (e.target.checked) {
                    newSet.add(typeMapping[resourceType]);
                  } else {
                    newSet.delete(typeMapping[resourceType]);
                  }
                  setVisibleResourceTypes(newSet);
                }}
                className="w-3 h-3"
              />
              <span className="flex-1">{resourceType}</span>
              <span className="text-gray-400 font-mono text-[10px]">
                {count}
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex gap-1">
        <button
          onClick={() =>
            setVisibleResourceTypes(new Set(Object.values(typeMapping)))
          }
          className="px-2 py-0.5 bg-green-600 hover:bg-green-700 text-white rounded text-[10px] font-semibold transition-colors"
        >
          All
        </button>
        <button
          onClick={() => setVisibleResourceTypes(new Set())}
          className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-semibold transition-colors"
        >
          None
        </button>
      </div>
    </div>
  );
}
