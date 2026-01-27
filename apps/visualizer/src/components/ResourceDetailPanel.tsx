import { useResourceDetail } from "../hooks/useResourceDetail";
import { formatAge } from "../types/resources";
import ResourceIcon from "./ResourceIcon";

interface ResourceDetailPanelProps {
  resourceId: string | null;
  onClose: () => void;
}

export default function ResourceDetailPanel({
  resourceId,
  onClose,
}: ResourceDetailPanelProps) {
  const { resource, loading, error } = useResourceDetail(resourceId);

  if (!resourceId) return null;

  return (
    <div className="bg-white/5 backdrop-blur-md rounded-lg border border-white/10 shadow-xl max-h-[85vh] overflow-hidden flex flex-col w-96">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 flex-shrink-0">
        <h2 className="text-white text-sm font-semibold">Resource Details</h2>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
        >
          <svg
            className="w-4 h-4"
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-white/70">Loading...</div>
          </div>
        )}

        {error && (
          <div className="p-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
              Error: {error.message}
            </div>
          </div>
        )}

        {resource && !loading && !error && (
          <>
            {/* Resource Header */}
            <div className="p-3 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ResourceIcon
                  resourceType={resource.resourceType}
                  className="w-8 h-8"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-white/50 uppercase tracking-wide font-semibold">
                    {resource.resourceType}
                  </div>
                  <div className="text-sm font-bold text-white truncate">
                    {resource.raw.metadata?.name}
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-3">
              <OverviewTab resource={resource} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function OverviewTab({ resource }: { resource: any }) {
  const metadata = resource.raw.metadata || {};
  const spec = resource.raw.spec || {};
  const status = resource.raw.status || {};

  return (
    <div className="space-y-3">
      {/* Basic Info */}
      <div className="bg-white/5 rounded-lg p-2 border border-white/10">
        <h3 className="text-white font-semibold text-[10px] mb-2 uppercase tracking-wide">
          Basic Information
        </h3>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-white/60">Name</span>
            <span className="text-white font-mono text-right">
              {metadata.name}
            </span>
          </div>
          {metadata.namespace && (
            <div className="flex justify-between">
              <span className="text-white/60">Namespace</span>
              <span className="text-white font-mono">{metadata.namespace}</span>
            </div>
          )}
          {metadata.creationTimestamp && (
            <div className="flex justify-between">
              <span className="text-white/60">Age</span>
              <span className="text-white">
                {formatAge(metadata.creationTimestamp)}
              </span>
            </div>
          )}
          {metadata.uid && (
            <div className="flex justify-between">
              <span className="text-white/60">UID</span>
              <span className="text-white font-mono text-xs truncate max-w-xs">
                {metadata.uid}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Labels */}
      {metadata.labels && Object.keys(metadata.labels).length > 0 && (
        <div className="bg-white/5 rounded-lg p-2 border border-white/10">
          <h3 className="text-white font-semibold text-[10px] mb-2 uppercase tracking-wide">
            Labels
          </h3>
          <div className="flex flex-wrap gap-1">
            {Object.entries(metadata.labels).map(([key, value]) => (
              <span
                key={key}
                className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-[10px] font-mono border border-blue-500/30 break-all"
              >
                {key}: {value as string}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Annotations */}
      {metadata.annotations && metadata.annotations.length > 0 && (
        <div className="bg-white/5 rounded-lg p-2 border border-white/10">
          <h3 className="text-white font-semibold text-[10px] mb-2 uppercase tracking-wide">
            Annotations
          </h3>
          <div className="space-y-0.5 text-[10px] font-mono max-h-32 overflow-y-auto no-scrollbar">
            {metadata.annotations.map(([key, value]: [string, string]) => (
              <div key={key} className="text-white/70 break-all">
                <span className="text-white/50">{key}:</span> {value}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status */}
      {Object.keys(status).filter((v) => v !== "loadBalancer").length > 0 && (
        <div className="bg-white/5 rounded-lg p-2 border border-white/10">
          <h3 className="text-white font-semibold text-[10px] mb-2 uppercase tracking-wide">
            Status
          </h3>
          <div className="space-y-1 text-xs">
            {status.phase && (
              <div className="flex justify-between text-[10px] bg-white/5 p-1 rounded">
                <span className="text-white/70">Phase</span>
                <span
                  className={`font-semibold ${
                    status.phase === "Running" || status.phase === "Active"
                      ? "text-green-400"
                      : status.phase === "Pending"
                        ? "text-yellow-400"
                        : status.phase === "Failed"
                          ? "text-red-400"
                          : "text-white"
                  }`}
                >
                  {status.phase}
                </span>
              </div>
            )}
            {status.availableReplicas !== undefined && (
              <div className="flex justify-between text-[10px] bg-white/5 p-1 rounded">
                <span className="text-white/70">availableReplicas</span>
                <span className="text-white">{status.availableReplicas}</span>
              </div>
            )}
            {status.fullyLabeledReplicas !== undefined && (
              <div className="flex justify-between text-[10px] bg-white/5 p-1 rounded">
                <span className="text-white/70">fullyLabeledReplicas</span>
                <span className="text-white">
                  {status.fullyLabeledReplicas}
                </span>
              </div>
            )}
            {status.observedGeneration !== undefined && (
              <div className="flex justify-between text-[10px] bg-white/5 p-1 rounded">
                <span className="text-white/70">observedGeneration</span>
                <span className="text-white">{status.observedGeneration}</span>
              </div>
            )}
            {status.readyReplicas !== undefined && (
              <div className="flex justify-between text-[10px] bg-white/5 p-1 rounded">
                <span className="text-white/70">readyReplicas</span>
                <span className="text-white">{status.readyReplicas}</span>
              </div>
            )}
            {status.replicas !== undefined && (
              <div className="flex justify-between text-[10px] bg-white/5 p-1 rounded">
                <span className="text-white/70">replicas</span>
                <span className="text-white">{status.replicas}</span>
              </div>
            )}
            {Array.isArray(status?.conditions) && (
              <div>
                <span className="text-white/60 block mb-1 text-[10px]">
                  Conditions
                </span>
                <div className="space-y-0.5">
                  {status.conditions.map((condition: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex justify-between text-[10px] bg-white/5 p-1 rounded"
                    >
                      <span className="text-white/70">{condition.type}</span>
                      <span
                        className={
                          condition.status === "True"
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        {condition.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resource-specific details */}
      {resource.resourceType === "Pod" && status.containerStatuses && (
        <div className="bg-white/5 rounded-lg p-2 border border-white/10">
          <h3 className="text-white font-semibold text-[10px] mb-2 uppercase tracking-wide">
            Containers
          </h3>
          <div className="space-y-2">
            {status.containerStatuses.map((container: any, idx: number) => (
              <div
                key={idx}
                className="bg-white/5 p-3 rounded border border-white/10"
              >
                <div className="flex justify-between items-center">
                  <span className="text-white font-mono text-sm">
                    {container.name}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      container.ready
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {container.ready ? "Ready" : "Not Ready"}
                  </span>
                </div>
                <div className="text-xs text-white/60 mt-1 font-mono truncate">
                  {container.image}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  Restarts: {container.restartCount}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {resource.resourceType === "Service" && spec.ports && (
        <div className="bg-white/5 rounded-lg p-2 border border-white/10">
          <h3 className="text-white font-semibold text-[10px] mb-2 uppercase tracking-wide">
            Ports
          </h3>
          <div className="space-y-2">
            {spec.ports.map((port: any, idx: number) => (
              <div
                key={idx}
                className="flex justify-between text-[10px] bg-white/5 p-1 rounded"
              >
                <span className="text-white/70">
                  {port.name || `Port ${idx + 1}`}
                </span>
                <span className="text-white">
                  {port.port}
                  {port.targetPort && ` → ${port.targetPort}`} /{" "}
                  {port.protocol || "TCP"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {resource.resourceType === "Deployment" && (
        <div className="bg-white/5 rounded-lg p-2 border border-white/10">
          <h3 className="text-white font-semibold text-[10px] mb-2 uppercase tracking-wide">
            Deployment Info
          </h3>
          <div className="space-y-2 text-[10px]">
            <div className="flex justify-between">
              <span className="text-white/60">Replicas</span>
              <span className="text-white">
                {status.readyReplicas || 0} / {spec.replicas || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Strategy</span>
              <span className="text-white">
                {spec.strategy?.type || "RollingUpdate"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ConfigMap Data */}
      {resource.resourceType === "ConfigMap" &&
        resource.raw.data &&
        Object.keys(resource.raw.data).length > 0 && (
          <div className="bg-white/5 rounded-lg p-2 border border-white/10">
            <h3 className="text-white font-semibold text-[10px] mb-2 uppercase tracking-wide">
              Data Keys
            </h3>
            <div className="space-y-1">
              {Object.entries(resource.raw.data).map(([key, value]) => (
                <div
                  key={key}
                  className="text-xs bg-white/5 p-2 rounded border border-white/10"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-mono font-semibold overflow-hidden">
                      {key}
                    </span>
                  </div>
                  <div className="text-white/60 text-[10px] font-mono break-all max-h-20 overflow-y-auto no-scrollbar">
                    {value as string}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
