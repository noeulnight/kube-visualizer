import { useEffect, useMemo, useState } from "react";

import ConnectionStatus from "./components/ConnectionStatus";
import D3GraphCanvas from "./components/D3GraphCanvas";
import ResourceDetailPanel from "./components/ResourceDetailPanel";
import ResourceSearch from "./components/ResourceSearch";
import ResourceTypeFilter from "./components/ResourceTypeFilter";
import { type GraphEdge, type GraphNode } from "./types/graph";
import { typeMapping } from "./types/resources";

export interface EdgeData {
  source: string;
  target: string;
  type: string;
}

export const ResourceType = {
  Pod: "Pod",
  Namespace: "Namespace",
  Node: "Node",
  Ingress: "Ingress",
  PersistentVolumeClaim: "PersistentVolumeClaim",
  PersistentVolume: "PersistentVolume",
  Deployment: "Deployment",
  ReplicaSet: "ReplicaSet",
  Service: "Service",
  ConfigMap: "ConfigMap",
  Secret: "Secret",
  ServiceAccount: "ServiceAccount",
  EndpointSlice: "EndpointSlice",
  DaemonSet: "DaemonSet",
  StatefulSet: "StatefulSet",
} as const;

export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

export interface NodeMetadata {
  id: string;
  name: string;
  namespace: string | undefined;
  resourceType: ResourceType;
}

export interface Delta {
  addedNodes: NodeMetadata[];
  modifiedNodes: NodeMetadata[];
  removedNodes: string[];
  addedEdges: EdgeData[];
  removedEdges: EdgeData[];
}

const resourceIcons: Record<string, string> = {
  namespace: "ns.svg",
  domain: "ing.svg",
  node: "node.svg",
  pod: "pod.svg",
  service: "svc.svg",
  ingress: "ing.svg",
  deployment: "deploy.svg",
  replicaSet: "rs.svg",
  daemonSet: "ds.svg",
  statefulSet: "sts.svg",
  configMap: "cm.svg",
  secret: "secret.svg",
  serviceAccount: "sa.svg",
  endpointSlice: "ep.svg",
  persistentVolume: "pv.svg",
  persistentVolumeClaim: "pvc.svg",
};

const getResourceIcon = (type: string) => resourceIcons[type] || "pod.svg";

const createEdge = (edge: EdgeData): GraphEdge => {
  let style = { stroke: "#999", strokeWidth: 1 };
  let animated = false;

  if (edge.type === "owner") {
    style = { stroke: "#f43f5e", strokeWidth: 2 };
  } else if (edge.type === "contains") {
    style = { stroke: "#a855f7", strokeWidth: 1 };
  } else if (edge.type === "selects") {
    style = { stroke: "#22c55e", strokeWidth: 1.5 };
    animated = true;
  } else if (edge.type === "routes-to") {
    style = { stroke: "#06b6d4", strokeWidth: 2 };
    animated = true;
  } else if (edge.type === "hosted-on") {
    style = { stroke: "#fb923c", strokeWidth: 1.5 };
  } else if (edge.type === "uses-secret") {
    style = { stroke: "#eab308", strokeWidth: 1.2 };
  } else if (edge.type === "uses-config") {
    style = { stroke: "#f59e0b", strokeWidth: 1.2 };
  } else if (edge.type === "has-endpoints") {
    style = { stroke: "#38bdf8", strokeWidth: 1.4 };
  }

  return {
    id: `e-${edge.type}-${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    label: edge.type,
    animated,
    style,
  };
};

export default function Flow() {
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [connected, setConnected] = useState<boolean>(false);
  const [reconnecting, setReconnecting] = useState<boolean>(false);
  const [reconnectAttempt, setReconnectAttempt] = useState<number>(0);
  const [allNodes, setAllNodes] = useState<GraphNode[]>([]);
  const [allEdges, setAllEdges] = useState<GraphEdge[]>([]);
  const [visibleResourceTypes, setVisibleResourceTypes] = useState<Set<string>>(
    new Set(Object.values(typeMapping)),
  );
  const [hiddenEdgeTypes, setHiddenEdgeTypes] = useState<Set<string>>(
    new Set(),
  );
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(
    null,
  );
  const [focusedResourceId, setFocusedResourceId] = useState<string | null>(
    null,
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState<boolean>(false);

  const { nodes, edges } = useMemo(() => {
    const filteredNodes = allNodes.filter((node) =>
      visibleResourceTypes.has(node.type),
    );
    const filteredNodeIds = new Set(filteredNodes.map((node) => node.id));
    const filteredEdges = allEdges.filter(
      (edge) =>
        !hiddenEdgeTypes.has(edge.label) &&
        filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target),
    );

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [visibleResourceTypes, hiddenEdgeTypes, allNodes, allEdges]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: number | null = null;
    let isMounted = true;

    const connect = (attempt: number = 0) => {
      if (!isMounted) return;

      const apiUrl = import.meta.env.VITE_API_URL || "";
      eventSource = new EventSource(`${apiUrl}/events`);

      eventSource.onopen = () => {
        if (!isMounted) return;
        setInitialLoading(false);
        setConnected(true);
        setReconnecting(false);
        setReconnectAttempt(0);
        console.log("Connected to cluster");
      };

      eventSource.onerror = (err) => {
        console.error("EventSource failed:", err);
        if (!isMounted) return;

        setInitialLoading(false);
        setConnected(false);
        eventSource?.close();

        const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 30000);
        const nextAttempt = attempt + 1;

        setReconnecting(true);
        setReconnectAttempt(nextAttempt);

        console.log(
          `Reconnecting in ${backoffDelay / 1000}s (attempt ${nextAttempt})...`,
        );

        reconnectTimeout = setTimeout(() => {
          if (isMounted) {
            connect(nextAttempt);
          }
        }, backoffDelay);
      };

      eventSource.onmessage = (event) => {
        if (!isMounted) return;
        setInitialLoading(false);
        setConnected(true);
        const delta = JSON.parse(event.data) as Delta;

        if (delta.addedNodes.length > 0) {
          const newNodes: GraphNode[] = delta.addedNodes.map((node) => {
            const type = typeMapping[node.resourceType] || "pod";
            return {
              id: node.id,
              type,
              data: { label: node.name, icon: getResourceIcon(type) },
              position: { x: 0, y: 0 },
            };
          });
          setAllNodes((currentNodes) => {
            const nodeMap = new Map(currentNodes.map((node) => [node.id, node]));
            newNodes.forEach((node) => nodeMap.set(node.id, node));
            return Array.from(nodeMap.values());
          });
        }

        if (delta.modifiedNodes.length > 0) {
          setAllNodes((currentNodes) => {
            let changed = false;
            const nextNodes = currentNodes.map((node) => {
              const modified = delta.modifiedNodes.find(
                (candidate) => candidate.id === node.id,
              );
              if (!modified) return node;

              const type = typeMapping[modified.resourceType] || "pod";
              const nextNode = {
                ...node,
                type,
                data: {
                  ...node.data,
                  label: modified.name,
                  icon: getResourceIcon(type),
                },
              };
              if (
                nextNode.type !== node.type ||
                nextNode.data.label !== node.data.label ||
                nextNode.data.icon !== node.data.icon
              ) {
                changed = true;
              }
              return nextNode;
            });
            return changed ? nextNodes : currentNodes;
          });
        }

        if (delta.removedNodes.length > 0) {
          setAllNodes((currentNodes) =>
            currentNodes.filter((node) => !delta.removedNodes.includes(node.id)),
          );
          setAllEdges((currentEdges) =>
            currentEdges.filter(
              (edge) =>
                !delta.removedNodes.includes(edge.source) &&
                !delta.removedNodes.includes(edge.target),
            ),
          );
        }

        if (delta.addedEdges.length > 0) {
          const newEdges = delta.addedEdges.map((edge) => createEdge(edge));
          setAllEdges((currentEdges) => {
            const edgeMap = new Map(currentEdges.map((edge) => [edge.id, edge]));
            newEdges.forEach((edge) => edgeMap.set(edge.id, edge));
            return Array.from(edgeMap.values());
          });
        }

        if (delta.removedEdges.length > 0) {
          setAllEdges((currentEdges) =>
            currentEdges.filter(
              (edge) =>
                !delta.removedEdges.some(
                  (removedEdge) =>
                    removedEdge.source === edge.source &&
                    removedEdge.target === edge.target,
                ),
            ),
          );
        }
      };
    };

    connect();

    return () => {
      isMounted = false;
      setInitialLoading(false);
      setConnected(false);
      setReconnecting(false);
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      eventSource?.close();
    };
  }, []);

  const handleSelectNode = (nodeId: string) => {
    setSelectedResourceId(nodeId);
    setFocusedResourceId(nodeId);
    setMobileFiltersOpen(false);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <D3GraphCanvas
        nodes={nodes}
        edges={edges}
        selectedNodeId={selectedResourceId}
        focusedNodeId={focusedResourceId}
        onNodeClick={setSelectedResourceId}
      />

      <div className="absolute inset-x-3 top-3 z-20 flex flex-col gap-2 sm:inset-x-auto sm:left-4 sm:top-4 sm:w-96">
        <ResourceSearch nodes={nodes} onSelectNode={handleSelectNode} />
        {selectedResourceId && (
          <ResourceDetailPanel
            resourceId={selectedResourceId}
            onClose={() => setSelectedResourceId(null)}
            className="hidden sm:flex"
          />
        )}
      </div>

      <div className="absolute bottom-16 right-3 z-10 sm:bottom-4 sm:right-4">
        <ConnectionStatus
          connected={connected}
          reconnecting={reconnecting}
          reconnectAttempt={reconnectAttempt}
        />
      </div>

      <div className="absolute right-4 top-4 hidden space-y-2 sm:block">
        <ResourceTypeFilter
          allNodes={allNodes}
          allEdges={allEdges}
          visibleResourceTypes={visibleResourceTypes}
          setVisibleResourceTypes={setVisibleResourceTypes}
          hiddenEdgeTypes={hiddenEdgeTypes}
          setHiddenEdgeTypes={setHiddenEdgeTypes}
        />
      </div>

      <div className="absolute inset-x-3 bottom-3 z-30 flex flex-col gap-2 sm:hidden">
        {selectedResourceId && (
          <ResourceDetailPanel
            resourceId={selectedResourceId}
            onClose={() => setSelectedResourceId(null)}
            className="max-h-[45vh] w-full"
          />
        )}

        {mobileFiltersOpen && (
          <ResourceTypeFilter
            allNodes={allNodes}
            allEdges={allEdges}
            visibleResourceTypes={visibleResourceTypes}
            setVisibleResourceTypes={setVisibleResourceTypes}
            hiddenEdgeTypes={hiddenEdgeTypes}
            setHiddenEdgeTypes={setHiddenEdgeTypes}
            className="max-h-[48vh] w-full"
          />
        )}

        <button
          type="button"
          onClick={() => setMobileFiltersOpen((isOpen) => !isOpen)}
          className="self-start rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md active:bg-white/20"
          aria-expanded={mobileFiltersOpen}
        >
          Filter
        </button>
      </div>

      {initialLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <div className="text-sm font-semibold tracking-wide">Loading</div>
          </div>
        </div>
      )}
    </div>
  );
}
