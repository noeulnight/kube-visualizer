import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

export interface BaseNodeData extends Record<string, unknown> {
  label: string;
  icon: string;
}

export type BaseNodeProps = NodeProps<Node<BaseNodeData>>;

const typeColors: Record<string, string> = {
  namespace: "border-purple-500/50 text-purple-200 bg-purple-500/10",
  node: "border-orange-500/50 text-orange-200 bg-orange-500/10",
  pod: "border-blue-500/50 text-blue-200 bg-blue-500/10",
  service: "border-green-500/50 text-green-200 bg-green-500/10",
  ingress: "border-cyan-500/50 text-cyan-200 bg-cyan-500/10",
  deployment: "border-pink-500/50 text-pink-200 bg-pink-500/10",
  replicaSet: "border-rose-500/50 text-rose-200 bg-rose-500/10",
  daemonSet: "border-indigo-500/50 text-indigo-200 bg-indigo-500/10",
  statefulSet: "border-teal-500/50 text-teal-200 bg-teal-500/10",
  configMap: "border-amber-500/50 text-amber-200 bg-amber-500/10",
  secret: "border-yellow-500/50 text-yellow-200 bg-yellow-500/10",
};

const BaseNode = ({
  data,
  selected,
  type,
  targetPosition = Position.Left,
  sourcePosition = Position.Right,
}: BaseNodeProps) => {
  const { label, icon } = data;
  const resourceType = type || "Resource";
  // const showContent = useStore((s) => s.transform[2] >= 0.7);

  const colorClass =
    typeColors[type || ""] || "border-white/10 text-white bg-white/5";

  return (
    <div
      className={`
      relative px-4 py-3 backdrop-blur-xl rounded-xl border-2 shadow-2xl transition-all duration-300 ease-in-out
      hover:border-white/40 hover:-translate-y-1 hover:shadow-white/5
      ${selected ? "ring-4 ring-blue-500/30 scale-105" : ""}
      ${colorClass}
      min-w-[180px] max-w-[350px]
    `}
    >
      <Handle
        type="target"
        position={targetPosition}
        className="!bg-slate-400 !w-2 !h-2"
      />

      <div className={`flex items-center gap-3`}>
        <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center p-1">
          <img
            src={`/k8s/${icon}`}
            alt={resourceType}
            className="w-full h-full object-contain brightness-125"
          />
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="text-[10px] font-black uppercase tracking-[0.15em] opacity-60 leading-none">
            {resourceType}
          </span>
          <span className="text-sm font-bold truncate leading-tight">
            {String(label)}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={sourcePosition}
        className="!bg-slate-400 !w-2 !h-2"
      />
    </div>
  );
};

export default memo(BaseNode);
