import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  let style = { stroke: "#999", strokeWidth: 0.7 };
  let animated = false;

  if (edge.type === "owner") {
    style = { stroke: "#f43f5e", strokeWidth: 0.7 };
  } else if (edge.type === "contains") {
    style = { stroke: "#a855f7", strokeWidth: 0.7 };
  } else if (edge.type === "selects") {
    style = { stroke: "#22c55e", strokeWidth: 0.7 };
    animated = true;
  } else if (edge.type === "routes-to") {
    style = { stroke: "#06b6d4", strokeWidth: 0.7 };
    animated = true;
  } else if (edge.type === "hosted-on") {
    style = { stroke: "#fb923c", strokeWidth: 0.7 };
  } else if (edge.type === "uses-secret") {
    style = { stroke: "#eab308", strokeWidth: 0.7 };
  } else if (edge.type === "uses-config") {
    style = { stroke: "#f59e0b", strokeWidth: 0.7 };
  } else if (edge.type === "has-endpoints") {
    style = { stroke: "#38bdf8", strokeWidth: 0.7 };
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

const isEmptyDelta = (delta: Delta) =>
  delta.addedNodes.length === 0 &&
  delta.modifiedNodes.length === 0 &&
  delta.removedNodes.length === 0 &&
  delta.addedEdges.length === 0 &&
  delta.removedEdges.length === 0;

const edgeKey = (edge: EdgeData) =>
  `${edge.type}|${edge.source}|${edge.target}`;

const mergeDeltas = (deltas: Delta[]): Delta => {
  const addedNodes = new Map<string, NodeMetadata>();
  const modifiedNodes = new Map<string, NodeMetadata>();
  const removedNodes = new Set<string>();
  const addedEdges = new Map<string, EdgeData>();
  const removedEdges = new Map<string, EdgeData>();

  deltas.forEach((delta) => {
    delta.addedNodes.forEach((node) => {
      removedNodes.delete(node.id);
      addedNodes.set(node.id, node);
    });

    delta.modifiedNodes.forEach((node) => {
      if (addedNodes.has(node.id)) {
        addedNodes.set(node.id, node);
        return;
      }
      if (!removedNodes.has(node.id)) {
        modifiedNodes.set(node.id, node);
      }
    });

    delta.removedNodes.forEach((nodeId) => {
      addedNodes.delete(nodeId);
      modifiedNodes.delete(nodeId);
      removedNodes.add(nodeId);
    });

    delta.addedEdges.forEach((edge) => {
      const key = edgeKey(edge);
      removedEdges.delete(key);
      addedEdges.set(key, edge);
    });

    delta.removedEdges.forEach((edge) => {
      const key = edgeKey(edge);
      addedEdges.delete(key);
      removedEdges.set(key, edge);
    });
  });

  return {
    addedNodes: Array.from(addedNodes.values()),
    modifiedNodes: Array.from(modifiedNodes.values()),
    removedNodes: Array.from(removedNodes),
    addedEdges: Array.from(addedEdges.values()),
    removedEdges: Array.from(removedEdges.values()),
  };
};

export default function Flow() {
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [initialGraphRendered, setInitialGraphRendered] =
    useState<boolean>(false);
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
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState<boolean>(true);
  const pendingDeltasRef = useRef<Delta[]>([]);
  const deltaFlushTimeoutRef = useRef<number | null>(null);

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

  const applyDelta = useCallback((delta: Delta) => {
    if (isEmptyDelta(delta)) {
      setInitialGraphRendered(true);
      setInitialLoading(false);
      setReconnecting(false);
      return;
    }

    if (
      delta.addedNodes.length > 0 ||
      delta.modifiedNodes.length > 0 ||
      delta.removedNodes.length > 0
    ) {
      const addedNodes = delta.addedNodes.map((node) => {
        const type = typeMapping[node.resourceType] || "pod";
        return {
          id: node.id,
          type,
          data: { label: node.name, icon: getResourceIcon(type) },
          position: { x: 0, y: 0 },
        };
      });
      const addedNodeMap = new Map(addedNodes.map((node) => [node.id, node]));
      const modifiedNodeMap = new Map(
        delta.modifiedNodes.map((node) => [node.id, node]),
      );
      const removedNodeSet = new Set(delta.removedNodes);

      setAllNodes((currentNodes) => {
        const nodeMap = new Map<string, GraphNode>();
        let changed = false;

        currentNodes.forEach((node) => {
          if (removedNodeSet.has(node.id)) {
            changed = true;
            return;
          }
          nodeMap.set(node.id, node);
        });

        addedNodeMap.forEach((node) => {
          nodeMap.set(node.id, node);
          changed = true;
        });

        modifiedNodeMap.forEach((modified, nodeId) => {
          const node = nodeMap.get(nodeId);
          if (!node) return;

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
            nodeMap.set(nodeId, nextNode);
            changed = true;
          }
        });

        return changed ? Array.from(nodeMap.values()) : currentNodes;
      });
    }

    if (
      delta.addedEdges.length > 0 ||
      delta.removedEdges.length > 0 ||
      delta.removedNodes.length > 0
    ) {
      const addedEdges = delta.addedEdges.map((edge) => createEdge(edge));
      const removedEdgeKeys = new Set(delta.removedEdges.map(edgeKey));
      const removedNodeSet = new Set(delta.removedNodes);

      setAllEdges((currentEdges) => {
        const edgeMap = new Map(currentEdges.map((edge) => [edge.id, edge]));
        let changed = false;

        if (removedEdgeKeys.size > 0 || removedNodeSet.size > 0) {
          edgeMap.forEach((edge, id) => {
            const key = edgeKey({
              source: edge.source,
              target: edge.target,
              type: edge.label,
            });
            if (
              removedEdgeKeys.has(key) ||
              removedNodeSet.has(edge.source) ||
              removedNodeSet.has(edge.target)
            ) {
              edgeMap.delete(id);
              changed = true;
            }
          });
        }

        addedEdges.forEach((edge) => {
          edgeMap.set(edge.id, edge);
          changed = true;
        });

        return changed ? Array.from(edgeMap.values()) : currentEdges;
      });
    }

    setReconnecting(false);
  }, []);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: number | null = null;
    let isMounted = true;

    const flushPendingDeltas = () => {
      deltaFlushTimeoutRef.current = null;
      if (!isMounted || pendingDeltasRef.current.length === 0) return;

      const delta = mergeDeltas(pendingDeltasRef.current);
      pendingDeltasRef.current = [];
      applyDelta(delta);
    };

    const scheduleDeltaFlush = () => {
      if (deltaFlushTimeoutRef.current !== null) return;

      deltaFlushTimeoutRef.current = window.setTimeout(flushPendingDeltas, 150);
    };

    const connect = (attempt: number = 0) => {
      if (!isMounted) return;

      const apiUrl = import.meta.env.VITE_API_URL || "";
      eventSource = new EventSource(`${apiUrl}/events`);

      eventSource.onopen = () => {
        if (!isMounted) return;
        setReconnectAttempt(0);
        console.log("Connected to cluster");
      };

      eventSource.onerror = (err) => {
        console.error("EventSource failed:", err);
        if (!isMounted) return;

        setInitialLoading(false);
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
        const delta = JSON.parse(event.data) as Delta;
        pendingDeltasRef.current.push(delta);
        scheduleDeltaFlush();
      };
    };

    connect();

    return () => {
      isMounted = false;
      setInitialLoading(false);
      setReconnecting(false);
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (deltaFlushTimeoutRef.current !== null) {
        window.clearTimeout(deltaFlushTimeoutRef.current);
      }
      eventSource?.close();
    };
  }, [applyDelta]);

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
        onInitialRenderComplete={() => {
          setInitialGraphRendered(true);
          setInitialLoading(false);
        }}
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

      <div className="absolute right-4 top-4 hidden flex-col items-end gap-2 sm:flex">
        <button
          type="button"
          onClick={() => setDesktopFiltersOpen((isOpen) => !isOpen)}
          className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md hover:bg-white/15"
          aria-expanded={desktopFiltersOpen}
        >
          Filter
        </button>

        {desktopFiltersOpen && (
          <ResourceTypeFilter
            allNodes={allNodes}
            allEdges={allEdges}
            visibleResourceTypes={visibleResourceTypes}
            setVisibleResourceTypes={setVisibleResourceTypes}
            hiddenEdgeTypes={hiddenEdgeTypes}
            setHiddenEdgeTypes={setHiddenEdgeTypes}
          />
        )}
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

      {(initialLoading || !initialGraphRendered || reconnecting) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-white">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <div className="text-sm font-semibold tracking-wide">
              {reconnecting ? `Reconnecting (${reconnectAttempt})` : "Loading"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
