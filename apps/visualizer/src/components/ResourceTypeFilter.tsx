import type { GraphNode } from "../types/graph";
import type { GraphEdge } from "../types/graph";
import { typeMapping } from "../types/resources";

interface ResourceTypeFilterProps {
  allNodes: GraphNode[];
  allEdges: GraphEdge[];
  visibleResourceTypes: Set<string>;
  setVisibleResourceTypes: (types: Set<string>) => void;
  hiddenEdgeTypes: Set<string>;
  setHiddenEdgeTypes: (types: Set<string>) => void;
}

export default function ResourceTypeFilter({
  allNodes,
  allEdges,
  visibleResourceTypes,
  setVisibleResourceTypes,
  hiddenEdgeTypes,
  setHiddenEdgeTypes,
}: ResourceTypeFilterProps) {
  const edgeTypeCounts = Array.from(
    allEdges.reduce((counts, edge) => {
      counts.set(edge.label, (counts.get(edge.label) || 0) + 1);
      return counts;
    }, new Map<string, number>()),
  ).sort(([left], [right]) => left.localeCompare(right));

  const toggleType = (type: string, checked: boolean) => {
    const newSet = new Set(visibleResourceTypes);
    if (checked) {
      newSet.add(type);
    } else {
      newSet.delete(type);
    }
    setVisibleResourceTypes(newSet);
  };

  const toggleEdgeType = (type: string, checked: boolean) => {
    const newSet = new Set(hiddenEdgeTypes);
    if (checked) {
      newSet.delete(type);
    } else {
      newSet.add(type);
    }
    setHiddenEdgeTypes(newSet);
  };

  return (
    <div className="bg-white/5 backdrop-blur-md p-3 rounded-lg border border-white/10 shadow-xl max-h-[60vh] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-semibold text-sm">Filter</h3>
      </div>

      <div className="min-h-0 overflow-y-auto no-scrollbar pr-1">
        <div className="flex flex-col gap-1 mb-3">
          <h4 className="text-white/70 font-semibold text-[10px] uppercase tracking-wide mb-1">
            Resource Types
          </h4>
          {Object.keys(typeMapping).map((resourceType) => {
            const type = typeMapping[resourceType];
            const count = allNodes.filter((node) => node.type === type).length;
            return (
              <label
                key={resourceType}
                className="flex items-center gap-2 text-white text-xs cursor-pointer hover:bg-white/10 p-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={visibleResourceTypes.has(type)}
                  onChange={(e) => toggleType(type, e.target.checked)}
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

        <div className="border-t border-white/10 pt-2 mb-3">
          <h4 className="text-white/70 font-semibold text-[10px] uppercase tracking-wide mb-1">
            Edge Types
          </h4>
          <div className="flex flex-col gap-1">
            {edgeTypeCounts.map(([type, count]) => (
              <label
                key={type}
                className="flex items-center gap-2 text-white text-xs cursor-pointer hover:bg-white/10 p-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={!hiddenEdgeTypes.has(type)}
                  onChange={(e) => toggleEdgeType(type, e.target.checked)}
                  className="w-3 h-3"
                />
                <span className="flex-1 font-mono">{type}</span>
                <span className="text-gray-400 font-mono text-[10px]">
                  {count}
                </span>
              </label>
            ))}
          </div>
        </div>
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
