import * as k8s from "@kubernetes/client-node";
import { Delta, Edge, NodeMetadata, ResourceData, ResourceType } from "./types";

const toMetadataNode = (res: ResourceData): NodeMetadata => {
  return {
    id: getResourceId(res),
    name: res.raw.metadata?.name || "",
    namespace: res.raw.metadata?.namespace ?? "",
    resourceType: res.resourceType,
  };
};

const getResourceId = (res: ResourceData): string => {
  return `${res.resourceType}:${res.raw.metadata?.namespace ?? ""}/${res.raw.metadata?.name}`;
};

const edgeKey = (edge: Edge): string => {
  return `${edge.source}|${edge.target}|${edge.type}`;
};

export const getEdges = (resources: ResourceData[]) => {
  const edges: { source: string; target: string; type: string }[] = [];

  resources.forEach((res) => {
    const resourceType = res.resourceType;
    const raw = res.raw;
    const name = raw.metadata?.name;
    const namespace = raw.metadata?.namespace ?? "";
    const id = `${resourceType}:${namespace}/${name}`;

    // 0. Namespace -> Top-level Resources
    if (
      namespace &&
      resourceType !== "Namespace" &&
      resourceType !== "Node"
      // && resourceType !== "Service"
    ) {
      const hasOwner =
        raw.metadata?.ownerReferences &&
        raw.metadata.ownerReferences.length > 0;
      if (!hasOwner) {
        edges.push({
          source: `Namespace:/${namespace}`,
          target: id,
          type: "contains",
        });
      }
    }

    // 1. Owner References (Deploy -> RS -> Pod, etc.)
    if (raw.metadata?.ownerReferences) {
      raw.metadata.ownerReferences.forEach((owner) => {
        const ownerId = `${owner.kind}:${namespace}/${owner.name}`;
        edges.push({
          source: ownerId,
          target: id,
          type: "owner",
        });
      });
    }

    // 2. Service -> Pod (Labels)
    // if (resourceType === "Service") {
    //   const selector = raw.spec?.selector;
    //   if (selector) {
    //     resources
    //       .filter(
    //         (r) =>
    //           r.resourceType === "Pod" &&
    //           r.raw.metadata?.namespace === namespace,
    //       )
    //       .forEach((pod) => {
    //         if (labelsMatch(selector, pod.raw.metadata?.labels)) {
    //           edges.push({
    //             source: id,
    //             target: `Pod:${namespace}/${pod.raw.metadata?.name}`,
    //             type: "selects",
    //           });
    //         }
    //       });
    //   }
    // }

    // 3. Ingress -> Service
    if (resourceType === ResourceType.Ingress) {
      res.raw.spec?.rules?.forEach((rule) => {
        rule.http?.paths?.forEach((path) => {
          const svcName = path.backend?.service?.name;
          if (svcName) {
            edges.push({
              source: id,
              target: `Service:${namespace}/${svcName}`,
              type: "routes-to",
            });
          }
        });
      });
    }

    // 4. Pod -> PVC and Node
    // if (resourceType === "Pod") {
    //   // Pod -> Node
    //   // if (raw.spec?.nodeName) {
    //   //   edges.push({
    //   //     source: `Node:undefined/${raw.spec.nodeName}`,
    //   //     target: id,
    //   //     type: "hosted-on",
    //   //   });
    //   // }
    //   // Pod -> PVC
    //   raw.spec?.volumes?.forEach((vol: any) => {
    //     if (vol.persistentVolumeClaim?.claimName) {
    //       edges.push({
    //         source: id,
    //         target: `PersistentVolumeClaim:${namespace}/${vol.persistentVolumeClaim.claimName}`,
    //         type: "uses-pvc",
    //       });
    //     }
    //   });
    // }

    // 5. PVC -> PV
    if (resourceType === ResourceType.PersistentVolumeClaim) {
      const spec = res.raw.spec as k8s.V1PersistentVolumeClaimSpec;
      if (spec.volumeName) {
        edges.push({
          source: id,
          target: `PersistentVolume:/${spec.volumeName}`,
          type: "binds-to",
        });
      }
    }
  });

  return edges;
};

export const buildDelta = (
  previousNodes: ResourceData[],
  currentNodes: ResourceData[],
): Delta => {
  // Create maps for efficient lookup
  const prevNodeMap = new Map<string, ResourceData>();
  const currNodeMap = new Map<string, ResourceData>();

  previousNodes.forEach((node) => {
    prevNodeMap.set(getResourceId(node), node);
  });

  currentNodes.forEach((node) => {
    currNodeMap.set(getResourceId(node), node);
  });

  // Find added and modified nodes
  const addedNodes: ResourceData[] = [];
  const modifiedNodes: ResourceData[] = [];

  currentNodes.forEach((currNode) => {
    const id = getResourceId(currNode);
    const prevNode = prevNodeMap.get(id);

    if (!prevNode) {
      // Node didn't exist before - it's added
      addedNodes.push(currNode);
    } else {
      // Node existed - check if it was modified
      // Compare resourceVersion to detect modifications
      const prevVersion = prevNode.raw.metadata?.resourceVersion;
      const currVersion = currNode.raw.metadata?.resourceVersion;

      if (prevVersion !== currVersion) {
        modifiedNodes.push(currNode);
      }
    }
  });

  // Find removed nodes
  const removedNodes: string[] = [];
  previousNodes.forEach((prevNode) => {
    const id = getResourceId(prevNode);
    if (!currNodeMap.has(id)) {
      removedNodes.push(id);
    }
  });

  // Calculate edges for both states
  const prevEdges = getEdges(previousNodes);
  const currEdges = getEdges(currentNodes);

  // Create edge sets for comparison
  const prevEdgeSet = new Set(prevEdges.map(edgeKey));
  const currEdgeSet = new Set(currEdges.map(edgeKey));

  // Find added edges
  const addedEdges: Edge[] = currEdges.filter(
    (edge) => !prevEdgeSet.has(edgeKey(edge)),
  );

  // Find removed edges
  const removedEdges: Edge[] = prevEdges.filter(
    (edge) => !currEdgeSet.has(edgeKey(edge)),
  );

  return {
    addedNodes: addedNodes.map(toMetadataNode),
    modifiedNodes: modifiedNodes.map(toMetadataNode),
    removedNodes,
    addedEdges,
    removedEdges,
  };
};
